"""SAFEIA desktop agent (Windows).

Tracks the active window title at a fixed interval, detects AI desktop apps
(Claude, ChatGPT, etc.), and reports usage heartbeats to the SAFEIA backend.

Browser windows are skipped on purpose: browser-based usage is already covered
by the SAFEIA browser extension, so counting it here too would double-count time.

Never reads window content, only the window title and the owning process name.

Double-clicking the packaged .exe with no config yet opens a one-time setup
window asking only for the API token (from Settings), then runs silently in
the background and starts automatically on login.
"""

from __future__ import annotations

import argparse
import ctypes
import json
import re
import socket
import sys
import time
import winreg
from dataclasses import dataclass, field
from pathlib import Path

import psutil
import requests
import win32gui
import win32process

CONFIG_DIR = Path.home() / ".safeia"
CONFIG_FILE = CONFIG_DIR / "config.json"

DEFAULT_API_BASE = "https://safe-ia-five.vercel.app"
STARTUP_REGISTRY_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
STARTUP_VALUE_NAME = "SAFEIAAgent"

TICK_SECONDS = 20
FLUSH_SECONDS = 60
IDLE_THRESHOLD_SECONDS = 60
MAX_QUEUE = 1000

BROWSER_PROCESSES = {
    "chrome.exe",
    "msedge.exe",
    "firefox.exe",
    "brave.exe",
    "opera.exe",
    "vivaldi.exe",
}

# Best-effort title patterns for AI desktop apps. Extend as needed.
PROVIDER_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"claude", re.IGNORECASE), "CLAUDE"),
    (re.compile(r"chatgpt", re.IGNORECASE), "CHATGPT"),
    (re.compile(r"gemini", re.IGNORECASE), "GEMINI"),
    (re.compile(r"copilot", re.IGNORECASE), "COPILOT"),
    (re.compile(r"perplexity", re.IGNORECASE), "PERPLEXITY"),
    (re.compile(r"mistral|le chat", re.IGNORECASE), "MISTRAL"),
    (re.compile(r"\bgrok\b", re.IGNORECASE), "GROK"),
    (re.compile(r"deepseek", re.IGNORECASE), "DEEPSEEK"),
    (re.compile(r"meta ai", re.IGNORECASE), "META"),
    (re.compile(r"\bpoe\b", re.IGNORECASE), "POE"),
]


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))


def save_config(config: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(config, indent=2), encoding="utf-8")


def register_startup() -> None:
    """Adds this exe to the current user's Windows login startup items."""
    exe_path = sys.executable if getattr(sys, "frozen", False) else None
    if not exe_path:
        return  # Running as a plain .py script — skip, nothing stable to point to.
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, STARTUP_REGISTRY_KEY, 0, winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, STARTUP_VALUE_NAME, 0, winreg.REG_SZ, f'"{exe_path}"')
    except OSError:
        pass  # Non-fatal — the agent still runs for this session.


def get_idle_seconds() -> float:
    class LASTINPUTINFO(ctypes.Structure):
        _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

    info = LASTINPUTINFO()
    info.cbSize = ctypes.sizeof(LASTINPUTINFO)
    ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info))
    millis = ctypes.windll.kernel32.GetTickCount() - info.dwTime
    return millis / 1000.0


def get_active_window() -> tuple[str, str] | None:
    """Returns (window_title, process_name) for the foreground window, or None."""
    hwnd = win32gui.GetForegroundWindow()
    if not hwnd:
        return None
    title = win32gui.GetWindowText(hwnd)
    if not title:
        return None
    try:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        process_name = psutil.Process(pid).name()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        process_name = ""
    return title, process_name


def detect_provider(title: str, process_name: str) -> str | None:
    if process_name.lower() in BROWSER_PROCESSES:
        return None
    for pattern, provider in PROVIDER_PATTERNS:
        if pattern.search(title):
            return provider
    return None


@dataclass
class Agent:
    api_base: str
    api_token: str
    device_name: str = field(default_factory=socket.gethostname)
    queue: list[dict] = field(default_factory=list)

    def enqueue(self, provider: str, duration_seconds: int, window_title: str) -> None:
        self.queue.append(
            {
                "source": "DESKTOP_AGENT",
                "provider": provider,
                "eventType": "HEARTBEAT",
                "durationSeconds": duration_seconds,
                "messageCount": 0,
                "windowTitle": window_title,
                "deviceName": self.device_name,
                "platform": "windows",
            }
        )
        if len(self.queue) > MAX_QUEUE:
            self.queue = self.queue[-MAX_QUEUE:]

    def flush(self) -> None:
        if not self.queue:
            return
        try:
            res = requests.post(
                f"{self.api_base.rstrip('/')}/api/events",
                json=self.queue,
                headers={"Authorization": f"Bearer {self.api_token}"},
                timeout=10,
            )
            if res.ok:
                print(f"[safeia] flushed {len(self.queue)} events")
                self.queue = []
            else:
                print(f"[safeia] flush failed: {res.status_code} {res.text[:200]}")
        except requests.RequestException as exc:
            print(f"[safeia] flush error (will retry): {exc}")

    def run(self) -> None:
        print(f"[safeia] agent started — reporting to {self.api_base} as {self.device_name}")
        last_flush = time.monotonic()
        while True:
            time.sleep(TICK_SECONDS)

            if get_idle_seconds() >= IDLE_THRESHOLD_SECONDS:
                continue

            window = get_active_window()
            if window is None:
                continue

            title, process_name = window
            provider = detect_provider(title, process_name)
            if provider:
                self.enqueue(provider, TICK_SECONDS, title)

            if time.monotonic() - last_flush >= FLUSH_SECONDS:
                self.flush()
                last_flush = time.monotonic()


def run_first_time_setup() -> dict | None:
    """Small GUI asking only for the API token. Returns the saved config, or None if cancelled."""
    import tkinter as tk
    from tkinter import messagebox, ttk

    result: dict = {}

    root = tk.Tk()
    root.title("SAFEIA — Configuration")
    root.geometry("420x260")
    root.resizable(False, False)

    pad = {"padx": 16, "pady": 6}

    tk.Label(root, text="Bienvenue sur SAFEIA", font=("Segoe UI", 13, "bold")).pack(
        anchor="w", **pad
    )
    tk.Label(
        root,
        text="Colle ton token API (page Paramètres du dashboard SAFEIA)\npuis clique Démarrer.",
        justify="left",
    ).pack(anchor="w", **pad)

    tk.Label(root, text="URL du backend").pack(anchor="w", padx=16)
    api_base_var = tk.StringVar(value=DEFAULT_API_BASE)
    ttk.Entry(root, textvariable=api_base_var, width=48).pack(padx=16, pady=(0, 8))

    tk.Label(root, text="Token API").pack(anchor="w", padx=16)
    api_token_var = tk.StringVar()
    ttk.Entry(root, textvariable=api_token_var, width=48).pack(padx=16, pady=(0, 8))

    def on_start() -> None:
        api_base = api_base_var.get().strip()
        api_token = api_token_var.get().strip()
        if not api_base or not api_token:
            messagebox.showwarning("SAFEIA", "Merci de renseigner l'URL et le token.")
            return
        result["api_base"] = api_base
        result["api_token"] = api_token
        root.destroy()

    def on_cancel() -> None:
        root.destroy()

    button_row = tk.Frame(root)
    button_row.pack(pady=12)
    ttk.Button(button_row, text="Annuler", command=on_cancel).pack(side="left", padx=6)
    ttk.Button(button_row, text="Démarrer", command=on_start).pack(side="left", padx=6)

    root.mainloop()

    if not result:
        return None

    save_config(result)
    register_startup()

    confirm = tk.Tk()
    confirm.withdraw()
    from tkinter import messagebox as mb

    mb.showinfo(
        "SAFEIA",
        "C'est configuré ! L'agent tourne maintenant en arrière-plan "
        "et démarrera automatiquement à chaque connexion Windows.",
    )
    confirm.destroy()

    return result


def cmd_configure(args: argparse.Namespace) -> None:
    config = load_config()
    config["api_base"] = args.api_base
    config["api_token"] = args.api_token
    if args.device_name:
        config["device_name"] = args.device_name
    save_config(config)
    print(f"[safeia] configuration saved to {CONFIG_FILE}")


def cmd_run(_: argparse.Namespace) -> None:
    config = load_config()
    api_base = config.get("api_base")
    api_token = config.get("api_token")
    if not api_base or not api_token:
        print("[safeia] not configured. Run: python safeia_agent.py configure --api-base <url> --api-token <token>")
        sys.exit(1)

    agent = Agent(
        api_base=api_base,
        api_token=api_token,
        device_name=config.get("device_name") or socket.gethostname(),
    )
    try:
        agent.run()
    except KeyboardInterrupt:
        agent.flush()
        print("\n[safeia] stopped")


def run_auto() -> None:
    """Entry point for a double-clicked .exe: first-run setup, then run silently."""
    config = load_config()
    if not config.get("api_base") or not config.get("api_token"):
        config = run_first_time_setup()
        if config is None:
            return

    agent = Agent(
        api_base=config["api_base"],
        api_token=config["api_token"],
        device_name=config.get("device_name") or socket.gethostname(),
    )
    try:
        agent.run()
    except KeyboardInterrupt:
        agent.flush()


def main() -> None:
    if len(sys.argv) == 1:
        run_auto()
        return

    parser = argparse.ArgumentParser(description="SAFEIA desktop usage agent")
    sub = parser.add_subparsers(dest="command", required=True)

    p_configure = sub.add_parser("configure", help="Save backend URL and API token")
    p_configure.add_argument("--api-base", required=True, help="e.g. https://votre-app.vercel.app")
    p_configure.add_argument("--api-token", required=True, help="From SAFEIA Settings page")
    p_configure.add_argument("--device-name", default=None)
    p_configure.set_defaults(func=cmd_configure)

    p_run = sub.add_parser("run", help="Start tracking and reporting usage")
    p_run.set_defaults(func=cmd_run)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
