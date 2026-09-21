import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiToken } from "@/lib/auth";
import { Prisma, type Source, type Provider, type EventType } from "@prisma/client";

const SOURCES: Source[] = ["BROWSER_EXTENSION", "DESKTOP_AGENT"];
const PROVIDERS: Provider[] = [
  "CLAUDE",
  "CHATGPT",
  "GEMINI",
  "COPILOT",
  "PERPLEXITY",
  "MISTRAL",
  "GROK",
  "DEEPSEEK",
  "META",
  "POE",
  "OTHER",
];
const EVENT_TYPES: EventType[] = [
  "HEARTBEAT",
  "MESSAGE_SENT",
  "SESSION_START",
  "SESSION_END",
];

type IncomingEvent = {
  source: string;
  provider: string;
  eventType: string;
  occurredAt?: string;
  durationSeconds?: number;
  messageCount?: number;
  windowTitle?: string;
  url?: string;
  deviceName?: string;
  platform?: string;
  metadata?: Record<string, unknown>;
};

function isValid<T>(value: string, allowed: T[]): value is T & string {
  return (allowed as unknown as string[]).includes(value);
}

export async function POST(request: Request) {
  const user = await getUserFromApiToken(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const events: IncomingEvent[] = Array.isArray(body) ? body : [body];
  if (events.length === 0) {
    return NextResponse.json({ error: "no events" }, { status: 400 });
  }
  if (events.length > 500) {
    return NextResponse.json({ error: "too many events (max 500)" }, { status: 400 });
  }

  let device = null;
  const deviceName = events.find((e) => e.deviceName)?.deviceName;
  if (deviceName) {
    device = await prisma.device.upsert({
      where: { userId_name: { userId: user.id, name: deviceName } },
      update: { lastSeenAt: new Date(), platform: events.find((e) => e.platform)?.platform ?? "unknown" },
      create: {
        userId: user.id,
        name: deviceName,
        platform: events.find((e) => e.platform)?.platform ?? "unknown",
      },
    });
  }

  const rows: Prisma.UsageEventCreateManyInput[] = [];
  for (const e of events) {
    if (!isValid(e.source, SOURCES)) {
      return NextResponse.json({ error: `invalid source: ${e.source}` }, { status: 400 });
    }
    if (!isValid(e.provider, PROVIDERS)) {
      return NextResponse.json({ error: `invalid provider: ${e.provider}` }, { status: 400 });
    }
    if (!isValid(e.eventType, EVENT_TYPES)) {
      return NextResponse.json({ error: `invalid eventType: ${e.eventType}` }, { status: 400 });
    }

    rows.push({
      userId: user.id,
      deviceId: device?.id,
      source: e.source,
      provider: e.provider,
      eventType: e.eventType,
      occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
      durationSeconds: e.durationSeconds ?? 0,
      messageCount: e.messageCount ?? 0,
      windowTitle: e.windowTitle,
      url: e.url,
      metadata: e.metadata as Prisma.InputJsonValue | undefined,
    });
  }

  const result = await prisma.usageEvent.createMany({ data: rows });

  return NextResponse.json({ inserted: result.count }, { status: 201 });
}
