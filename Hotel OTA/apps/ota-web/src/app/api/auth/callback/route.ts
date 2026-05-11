import { NextRequest, NextResponse } from 'next/server';

const REZ_AUTH_URL = process.env.NEXT_PUBLIC_REZ_AUTH_URL || 'https://rez-auth-service.onrender.com';
const REZ_CLIENT_ID = process.env.NEXT_PUBLIC_REZ_OAUTH_CLIENT_ID || 'stay-owen';
const REZ_CLIENT_SECRET = process.env.REZ_OAUTH_CLIENT_SECRET || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hotel-ota.vercel.app';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

/**
 * GET /api/auth/callback
 *
 * OAuth2 callback handler for Hotel OTA (StayOwn).
 * Exchanges authorization code for REZ access token, then calls the Hotel OTA
 * backend /auth/rez-sso endpoint to link the REZ account to an OTA account.
 *
 * Flow:
 * 1. Auth service redirects here with ?code=xxx&state=yyy
 * 2. Exchange code for tokens at REZ Auth Service /oauth/token
 * 3. POST rez_access_token to Hotel OTA /auth/rez-sso
 * 4. Set ota_session cookie with OTA access token
 * 5. Redirect to /home or original destination
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    const redirectUrl = new URL('/?login=1', request.url);
    redirectUrl.searchParams.set('oauth_error', error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  let redirectTo = '/home';
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      redirectTo = decoded.redirectTo || '/home';
    } catch {
      // Invalid state — redirect home
    }
  }

  try {
    // Exchange code for tokens at REZ Auth Service
    const tokenRes = await fetch(`${REZ_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${APP_URL}/api/auth/callback`,
        client_id: REZ_CLIENT_ID,
        client_secret: REZ_CLIENT_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      console.error('[oauth-callback] Token exchange failed:', await tokenRes.json().catch(() => ({})));
      return NextResponse.redirect(new URL(`/?login=1&oauth_error=token_exchange_failed`, request.url));
    }

    const tokenData = await tokenRes.json();
    const { access_token } = tokenData;

    if (!access_token) {
      console.error('[oauth-callback] Missing access_token in response:', tokenData);
      return NextResponse.redirect(new URL(`/?login=1&oauth_error=invalid_token_response`, request.url));
    }

    // Call Hotel OTA backend /auth/rez-sso to link REZ account
    const ssoRes = await fetch(`${API_BASE}/auth/rez-sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rez_access_token: access_token }),
    });

    if (!ssoRes.ok) {
      console.error('[oauth-callback] REZ SSO failed:', await ssoRes.json().catch(() => ({})));
      return NextResponse.redirect(new URL(`/?login=1&oauth_error=sso_failed`, request.url));
    }

    const ssoData = await ssoRes.json();
    const { access_token: otaToken, user } = ssoData;

    if (!otaToken) {
      console.error('[oauth-callback] Missing otaToken in SSO response:', ssoData);
      return NextResponse.redirect(new URL(`/?login=1&oauth_error=invalid_sso_response`, request.url));
    }

    // Set ota_session cookie (same as regular login)
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}` +
      (isProduction ? '; Secure' : '');

    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.set('ota_session', otaToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    // Store user data in localStorage (same as regular login)
    if (user && typeof window === 'undefined') {
      response.headers.set('X-Ota-User', JSON.stringify(user));
    }

    return response;
  } catch (err) {
    console.error('[oauth-callback] Error:', err);
    return NextResponse.redirect(new URL(`/?login=1&oauth_error=callback_error`, request.url));
  }
}
