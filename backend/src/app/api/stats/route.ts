import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStats } from "@/lib/stats";

export async function GET(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "7d";

  const stats = await getStats(sessionUser, range);
  return NextResponse.json(stats);
}
