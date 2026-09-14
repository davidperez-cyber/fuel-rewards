import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { StaffRole } from '@prisma/client';

const COOKIE_NAME = 'fuel_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h shift

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short. Set it in .env.');
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string; // staff user id
  name: string;
  role: StaffRole;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub || !payload.role || !payload.name) return null;
    return { sub: payload.sub as string, name: payload.name as string, role: payload.role as StaffRole };
  } catch {
    return null;
  }
}

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
