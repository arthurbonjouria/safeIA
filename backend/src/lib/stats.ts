import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

export function rangeToDate(range: string): Date {
  const now = new Date();
  const days = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 }[range] ?? 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function getStats(sessionUser: User, range: string) {
  const since = rangeToDate(range);
  const now = new Date();
  const previousSince = new Date(since.getTime() - (now.getTime() - since.getTime()));

  const userScope =
    sessionUser.role === "ADMIN"
      ? { organizationId: sessionUser.organizationId }
      : { id: sessionUser.id };

  const scopedUsers = await prisma.user.findMany({
    where: userScope,
    select: { id: true, name: true, email: true },
  });
  const userIds = scopedUsers.map((u) => u.id);

  const where = { userId: { in: userIds }, occurredAt: { gte: since } };
  const previousWhere = {
    userId: { in: userIds },
    occurredAt: { gte: previousSince, lt: since },
  };

  const [byProvider, bySource, byUser, totals, previousTotals, dailyRaw, hourlyRaw] = await Promise.all([
    prisma.usageEvent.groupBy({
      by: ["provider"],
      where,
      _sum: { durationSeconds: true, messageCount: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["source"],
      where,
      _sum: { durationSeconds: true, messageCount: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["userId"],
      where,
      _sum: { durationSeconds: true, messageCount: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.aggregate({
      where,
      _sum: { durationSeconds: true, messageCount: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.aggregate({
      where: previousWhere,
      _sum: { durationSeconds: true, messageCount: true },
      _count: { _all: true },
    }),
    userIds.length > 0
      ? prisma.$queryRawUnsafe<
          { day: Date; provider: string; duration: bigint; messages: bigint }[]
        >(
          `SELECT date_trunc('day', "occurredAt") as day, provider,
                  SUM("durationSeconds")::bigint as duration,
                  SUM("messageCount")::bigint as messages
           FROM "UsageEvent"
           WHERE "userId" = ANY($1) AND "occurredAt" >= $2
           GROUP BY day, provider
           ORDER BY day ASC`,
          userIds,
          since
        )
      : Promise.resolve([]),
    userIds.length > 0
      ? prisma.$queryRawUnsafe<{ hour: number; duration: bigint; messages: bigint }[]>(
          `SELECT EXTRACT(HOUR FROM "occurredAt")::int as hour,
                  SUM("durationSeconds")::bigint as duration,
                  SUM("messageCount")::bigint as messages
           FROM "UsageEvent"
           WHERE "userId" = ANY($1) AND "occurredAt" >= $2
           GROUP BY hour
           ORDER BY hour ASC`,
          userIds,
          since
        )
      : Promise.resolve([]),
  ]);

  function pctChange(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? null : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  const userMap = new Map(scopedUsers.map((u) => [u.id, u]));

  return {
    range,
    isAdmin: sessionUser.role === "ADMIN",
    totals: {
      durationSeconds: totals._sum.durationSeconds ?? 0,
      messageCount: totals._sum.messageCount ?? 0,
      events: totals._count._all,
    },
    byProvider: byProvider.map((p) => ({
      provider: p.provider,
      durationSeconds: p._sum.durationSeconds ?? 0,
      messageCount: p._sum.messageCount ?? 0,
      events: p._count._all,
    })),
    bySource: bySource.map((s) => ({
      source: s.source,
      durationSeconds: s._sum.durationSeconds ?? 0,
      messageCount: s._sum.messageCount ?? 0,
      events: s._count._all,
    })),
    byUser: byUser
      .map((u) => ({
        userId: u.userId,
        name: userMap.get(u.userId)?.name ?? "Unknown",
        email: userMap.get(u.userId)?.email ?? "",
        durationSeconds: u._sum.durationSeconds ?? 0,
        messageCount: u._sum.messageCount ?? 0,
        events: u._count._all,
      }))
      .sort((a, b) => b.durationSeconds - a.durationSeconds),
    daily: dailyRaw.map((d) => ({
      day: d.day,
      provider: d.provider,
      durationSeconds: Number(d.duration),
      messageCount: Number(d.messages),
    })),
    hourly: Array.from({ length: 24 }, (_, hour) => {
      const row = hourlyRaw.find((h) => h.hour === hour);
      return {
        hour,
        durationSeconds: row ? Number(row.duration) : 0,
        messageCount: row ? Number(row.messages) : 0,
      };
    }),
    trends: {
      durationSeconds: pctChange(
        totals._sum.durationSeconds ?? 0,
        previousTotals._sum.durationSeconds ?? 0
      ),
      messageCount: pctChange(
        totals._sum.messageCount ?? 0,
        previousTotals._sum.messageCount ?? 0
      ),
      events: pctChange(totals._count._all, previousTotals._count._all),
    },
  };
}

export type Stats = Awaited<ReturnType<typeof getStats>>;
