import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { prisma } from '../db/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  hasProfile: boolean;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export { AuthError };

// ─── Helpers ────────────────────────────────────────────────────────────────

function requireSecret(): string {
  if (!env.JWT_SECRET) {
    throw new AuthError(500, 'JWT_SECRET not configured on the server');
  }
  return env.JWT_SECRET;
}

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, requireSecret(), {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

async function toAuthUser(u: { id: string; email: string; name: string | null }): Promise<AuthUser> {
  const profile = await prisma.profile.findUnique({ where: { id: u.id }, select: { id: true } });
  return { id: u.id, email: u.email, name: u.name, hasProfile: Boolean(profile) };
}

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

// ─── Public API ───────────────────────────────────────────────────────────

export async function register(email: string, password: string, name?: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) throw new AuthError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: normalized, passwordHash, name: name?.trim() || null },
  });

  return { token: signToken(user.id), user: await toAuthUser(user) };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || !user.passwordHash) throw new AuthError(401, 'Invalid email or password');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AuthError(401, 'Invalid email or password');

  return { token: signToken(user.id), user: await toAuthUser(user) };
}

/** Verify a Google ID-token credential, then upsert the user. */
export async function googleLogin(credential: string): Promise<AuthResult> {
  if (!googleClient || !env.GOOGLE_CLIENT_ID) {
    throw new AuthError(503, 'Google sign-in is not configured (set GOOGLE_CLIENT_ID)');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new AuthError(401, 'Invalid Google token');

  const googleSub = payload.sub;
  const email = payload.email.toLowerCase();
  const name = payload.name ?? null;

  // Match by google_sub first, fall back to email (link existing password account).
  let user = await prisma.user.findUnique({ where: { googleSub } });
  if (!user) user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({ data: { email, googleSub, name } });
  } else if (!user.googleSub) {
    user = await prisma.user.update({ where: { id: user.id }, data: { googleSub } });
  }

  return { token: signToken(user.id), user: await toAuthUser(user) };
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) throw new AuthError(404, 'User not found');
  return toAuthUser(user);
}
