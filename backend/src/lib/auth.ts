import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const SESSION_COOKIE = "safeia_session";

export type SessionPayload = {
  userId: string;
};

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { organization: true },
    });
    return user;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };

/** Authenticate an ingestion request (browser extension / desktop agent) via Bearer API token. */
export async function getUserFromApiToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  return prisma.user.findUnique({ where: { apiToken: token } });
}
