"""SAFEIA desktop agent (Windows).

Tracks the active window title at a fixed interval, detects AI desktop apps
(Claude, ChatGPT, etc.), and reports usage heartbeats to the SAFEIA backend.

Browser windows are skipped on purpose: browser-based usage is already covered
by the SAFEIA browser extension, so counting it here too would double-count time.

Never reads window content, only the window title and the owning process name.
"""

from __future__ import annotations

import argparse
import ctypes
import json
import re
import socket
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import psutil
import requests
import win32gui
import win32process

CONFIG_DIR = Path.home() / ".safeia"
CONFIG_FILE = CONFIG_DIR / "config.json"

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
    (re.compile(r"mistral", re.IGNORECASE), "MISTRAL"),
]


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))


def save_config(config: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(config, indent=2), encoding="utf-8")


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


def main() -> None:
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
