import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { email, password, name, organizationName } = body ?? {};

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password, name are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "an account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // First user in an org becomes admin. If no organizationName given, create a personal org.
  let organization = organizationName
    ? await prisma.organization.findFirst({ where: { name: organizationName } })
    : null;

  const isNewOrg = !organization;
  if (!organization) {
    organization = await prisma.organization.create({
      data: { name: organizationName || `${name}'s Org` },
    });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      organizationId: organization.id,
      role: isNewOrg ? "ADMIN" : "MEMBER",
    },
  });

  const token = signSession({ userId: user.id });
  const response = NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    apiToken: user.apiToken,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
