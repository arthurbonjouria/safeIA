import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    apiToken: user.apiToken,
    organizationId: user.organizationId,
  });
}

/** Rotate the API token (e.g. if it leaked). */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { apiToken: crypto.randomUUID() },
  });

  return NextResponse.json({ apiToken: updated.apiToken });
}
