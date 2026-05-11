import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '../../config/api';

const REZ_AUTH_URL = import.meta.env.VITE_REZ_AUTH_URL || 'https://rez-auth-service.onrender.com';
const REZ_CLIENT_ID = import.meta.env.VITE_REZ_OAUTH_CLIENT_ID || 'hotel-pms';
const REZ_CLIENT_SECRET = import.meta.env.VITE_REZ_OAUTH_CLIENT_SECRET || '';
const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5173';

/**
 * OAuth2 callback handler for Hotel PMS.
 * Exchanges the authorization code for a REZ access token, then calls
 * the PMS backend /auth/rez-sso endpoint to complete the login flow.
 */
export default function RezCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      navigate(`/login?oauth_error=${error}`, { replace: true });
      return;
    }

    if (!code) {
      navigate('/login', { replace: true });
      return;
    }

    let redirectTo = '/';
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
        redirectTo = decoded.redirectTo || '/';
      } catch {
        // Invalid state
      }
    }

    async function handleCallback() {
      try {
        // Exchange code for tokens at REZ Auth Service
        const tokenRes = await fetch(`${REZ_AUTH_URL}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: `${APP_URL}/auth/rez-callback`,
            client_id: REZ_CLIENT_ID,
            client_secret: REZ_CLIENT_SECRET,
          }),
        });

        if (!tokenRes.ok) {
          const errData = await tokenRes.json().catch(() => ({}));
          console.error('[rez-callback] Token exchange failed:', errData);
          navigate('/login?oauth_error=token_exchange_failed', { replace: true });
          return;
        }

        const tokenData = await tokenRes.json();
        const { access_token } = tokenData;

        if (!access_token) {
          console.error('[rez-callback] Missing access_token:', tokenData);
          navigate('/login?oauth_error=invalid_token_response', { replace: true });
          return;
        }

        // Call PMS backend /auth/rez-sso to complete login
        const ssoRes = await fetch(`${API_CONFIG.BASE_URL}/auth/rez-sso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ rez_access_token: access_token }),
        });

        if (!ssoRes.ok) {
          const errData = await ssoRes.json().catch(() => ({}));
          console.error('[rez-callback] REZ SSO failed:', errData);
          navigate('/login?oauth_error=sso_failed', { replace: true });
          return;
        }

        // Backend sets httpOnly cookies for access + refresh tokens
        navigate(redirectTo, { replace: true });
      } catch (err) {
        console.error('[rez-callback] Error:', err);
        navigate('/login?oauth_error=callback_error', { replace: true });
      }
    }

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Completing sign-in...</p>
      </div>
    </div>
  );
}
