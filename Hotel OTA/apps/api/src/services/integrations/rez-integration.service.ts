import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { Errors } from '../../utils/errors';

export interface RezUserProfile {
  id: string;
  phone: string;      // raw from REZ (E.164, e.g. "+918011549915")
  phoneE10: string;   // normalized to 10-digit for OTA (e.g. "8011549915")
  name?: string;
  role: string;
}

export interface RezWalletBalance {
  balance: {
    total: number;
    available: number;
    pending: number;
    cashback: number;
  };
  coins: Array<{
    type: string;
    amount: number;
    isActive: boolean;
  }>;
}

/**
 * Strip country code from E.164 phone to match OTA's 10-digit format.
 * "+918011549915" → "8011549915"
 * "8011549915"    → "8011549915" (already 10-digit)
 */
function normalizePhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, ''); // strip everything non-numeric
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2); // Indian +91
  if (digits.length === 10) return digits;
  // Fallback: take last 10 digits
  return digits.slice(-10);
}

/**
 * REZ Integration Service
 * Handles SSO, wallet sync, and profile sync with REZ platform
 */
export class RezIntegrationService {
  private static readonly HTTP_TIMEOUT = 5000; // 5 seconds
  private static readonly WALLET_SYNC_TIMEOUT = 3000; // 3 seconds

  /**
   * Verify REZ access token and get user profile.
   *
   * OAuth2 tokens are opaque random strings stored in Redis.
   * Validation is done via the /oauth/userinfo endpoint.
   */
  static async verifyRezToken(rezAccessToken: string): Promise<RezUserProfile> {
    try {
      const userinfoResp = await axios.get(
        `${env.AUTH_SERVICE_URL}/oauth/userinfo`,
        {
          headers: { Authorization: `Bearer ${rezAccessToken}` },
          timeout: this.HTTP_TIMEOUT,
        }
      );

      const userData = userinfoResp.data;
      const rawPhone = (userData.phone || '') as string;

      return {
        id: userData.sub,
        phone: rawPhone,
        phoneE10: normalizePhone(rawPhone),
        name: userData.name || undefined,
        role: userData.role || 'USER',
      };
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw Errors.validation('Invalid or expired REZ token');
      }
      if (axios.isAxiosError(error)) {
        throw Errors.internal('REZ auth service unavailable');
      }
      throw Errors.validation('Invalid or expired REZ token');
    }
  }

  /**
   * Get REZ wallet balance for a user.
   * Returns balance converted to paise.
   * Returns 0 silently if REZ wallet service is unavailable.
   */
  static async getRezWalletBalance(rezUserId: string): Promise<number> {
    try {
      const response = await axios.get(
        `${env.WALLET_SERVICE_URL}/internal/balance/${rezUserId}`,
        {
          headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN },
          timeout: this.WALLET_SYNC_TIMEOUT,
        }
      );

      if (!response.data.success || !response.data.data) return 0;

      const walletData: RezWalletBalance = response.data.data;
      const coinAmount = walletData.balance.available || 0;

      // Convert: coins × COIN_TO_RUPEE_RATE × 100 = paise
      return Math.round(coinAmount * env.REZ_COIN_TO_RUPEE_RATE * 100);
    } catch (err: any) {
      console.warn('[RezIntegration] Wallet balance fetch failed:', err.message);
      return 0;
    }
  }

  /**
   * Sync REZ wallet balance to OTA Postgres.
   */
  static async syncRezWalletBalance(otaUserId: string, rezUserId: string): Promise<number> {
    const rezCoinBalancePaise = await this.getRezWalletBalance(rezUserId);

    await prisma.coinWallet.update({
      where: { userId: otaUserId },
      data: { rezCoinBalancePaise },
    });

    return rezCoinBalancePaise;
  }

  /**
   * Find or create OTA user from REZ profile.
   * Links by phone (10-digit normalized). Three cases:
   *  1. Found by phone, already linked → return as-is
   *  2. Found by phone, not linked → write rezUserId
   *  3. Not found → create user + wallet
   */
  static async linkOrCreateOtaUser(rezProfile: RezUserProfile): Promise<{
    user: any;
    isNewUser: boolean;
    wallet: any;
  }> {
    let user = await prisma.user.findUnique({
      where: { phone: rezProfile.phoneE10 },
    });

    const isNewUser = !user;

    if (user) {
      if (!user.rezUserId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { rezUserId: rezProfile.id },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          phone: rezProfile.phoneE10,
          fullName: rezProfile.name,
          rezUserId: rezProfile.id,
          attributionSource: 'rez_app',
        },
      });

      await prisma.coinWallet.create({
        data: { userId: user.id },
      });
    }

    const wallet = await prisma.coinWallet.findUnique({
      where: { userId: user.id },
    });

    return { user, isNewUser, wallet };
  }

  /**
   * Full SSO flow:
   * 1. Verify REZ token via /oauth/userinfo
   * 2. Link/create OTA user
   * 3. Sync REZ wallet balance
   * 4. Issue OTA JWT
   */
  static async completeSsoFlow(rezAccessToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      phone: string;
      fullName?: string;
      tier: string;
      otaCoinBalancePaise: number;
      rezCoinBalancePaise: number;
      isNewUser: boolean;
    };
  }> {
    const rezProfile = await this.verifyRezToken(rezAccessToken);
    const { user, isNewUser, wallet } = await this.linkOrCreateOtaUser(rezProfile);
    const rezCoinBalancePaise = await this.syncRezWalletBalance(user.id, rezProfile.id);

    const payload = { userId: user.id, phone: user.phone, tier: user.tier };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRY });
    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.REFRESH_TOKEN_EXPIRY }
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        tier: user.tier,
        otaCoinBalancePaise: wallet?.otaCoinBalancePaise || 0,
        rezCoinBalancePaise,
        isNewUser,
      },
    };
  }
}
