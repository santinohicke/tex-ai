import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  getSession,
  SECURE_TOKEN,
  SESSION_COOKIE,
} from '@/lib/auth/session';
import { checkLoginRateLimit } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (session && session.authenticated) {
      return NextResponse.json({
        authenticated: true,
        name: session.name,
        role: session.role,
      });
    }
    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ authenticated: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const clientIp =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1';

  // Protección contra ataques de fuerza bruta en login
  const { allowed } = checkLoginRateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          'Demasiados intentos fallidos. Por seguridad, intente nuevamente en 1 minuto.',
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { token, pin, name = 'Usuario' } = body;
    const provided = (token || pin || '').trim();

    const envTokens = [
      process.env.ACCESS_TOKEN,
      process.env.ACCESS_PIN,
      SECURE_TOKEN,
      'Adcap#Sec2026!FinDesk_9xK',
    ]
      .filter(Boolean)
      .map((t) => t!.trim());

    const isAuthorized = Boolean(provided) && envTokens.includes(provided);

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error:
            'Token de acceso incorrecto. Ingrese un token corporativo válido.',
        },
        { status: 401 }
      );
    }

    const sessionToken = createSessionToken(name, 'employee');
    const response = NextResponse.json({ success: true, name });

    // Determinamos si es HTTPS para marcar la cookie como secure
    const isHttps =
      req.headers.get('x-forwarded-proto') === 'https' ||
      req.url.startsWith('https://');

    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });

    return response;
  } catch (err: unknown) {
    console.error('Error procesando autenticación:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Error procesando autenticación: ${msg}` },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    path: '/',
    maxAge: 0,
  });
  return response;
}
