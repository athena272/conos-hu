import crypto from "crypto";
import type { UserRole } from "../types/roles";

export interface AuthTokenPayload {
  sub: number;
  email: string;
  role: UserRole;
}

interface JwtBody extends AuthTokenPayload {
  exp: number;
}

const DEV_FALLBACK_SECRET = "conos-dev-jwt-secret-change-in-production";

export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s && s.trim().length > 0) return s.trim();
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  console.warn("JWT_SECRET não definido; usando segredo apenas para desenvolvimento.");
  return DEV_FALLBACK_SECRET;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signSegment(headerB64: string, payloadB64: string, secret: string): string {
  const data = `${headerB64}.${payloadB64}`;
  return b64url(crypto.createHmac("sha256", secret).update(data).digest());
}

export function signAuthToken(params: {
  userId: number;
  email: string;
  role: UserRole;
}): string {
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const secret = getJwtSecret();
  const headerB64 = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body: JwtBody = {
    sub: params.userId,
    email: params.email,
    role: params.role,
    exp,
  };
  const payloadB64 = b64url(JSON.stringify(body));
  const sig = signSegment(headerB64, payloadB64, secret);
  return `${headerB64}.${payloadB64}.${sig}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const secret = getJwtSecret();
  const expected = signSegment(headerB64, payloadB64, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sigB64, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid token signature");
  }
  let b64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  const json = Buffer.from(b64, "base64").toString("utf8");
  const parsed = JSON.parse(json) as JwtBody;
  if (typeof parsed.exp === "number" && parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  if (typeof parsed.sub !== "number" || typeof parsed.email !== "string") {
    throw new Error("Invalid token payload");
  }
  if (parsed.role !== "admin" && parsed.role !== "viewer") {
    throw new Error("Invalid token role");
  }
  return { sub: parsed.sub, email: parsed.email, role: parsed.role };
}
