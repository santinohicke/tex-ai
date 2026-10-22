import { cookies } from 'next/headers';
import crypto from 'crypto';

const SESSION_COOKIE = 'tex_auth_token';
const AUTH_SECRET =
  process.env.AUTH_SECRET || 'tex_sec_hmac_sign_99f4d2a1b7e80c45d3e2a1b9f8e7';
const SECURE_TOKEN =
  process.env.ACCESS_TOKEN ||
  process.env.ACCESS_PIN ||
  'Tex#Sec2026!Global_98xK';

export interface UserSession {
  authenticated: boolean;
  role: 'employee' | 'guest' | 'admin';
  name: string;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
}

export function createSessionToken(
  name: string,
  role: 'employee' | 'guest' | 'admin'
): string {
  const payload = JSON.stringify({
    authenticated: true,
    role,
    name,
    createdAt: Date.now(),
  });
  const b64 = Buffer.from(payload).toString('base64url');
  const signature = sign(b64);
  return `${b64}.${signature}`;
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [b64, signature] = parts;
  const expectedSignature = sign(b64);

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);
  if (
    sigBuffer.length !== expBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expBuffer)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8'));
    if (!data || !data.authenticated) return null;
    return data;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE, SECURE_TOKEN };
