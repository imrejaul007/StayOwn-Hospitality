import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { generateOtp, generateRef } from '../../utils/helpers';
import { Errors } from '../../utils/errors';
import { NotificationService } from '../notifications/notification.service';

export class AuthService {
  /**
   * Send OTP to phone number
   */
  static async sendOtp(phone: string): Promise<{ otpRef: string; expiresInSeconds: number; devOtp?: string }> {
    const otp = generateOtp();
    const otpRef = generateRef('otp');
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 120 * 1000); // 2 minutes

    await prisma.otpRecord.create({
      data: {
        phone,
        otpHash,
        otpRef,
        expiresAt,
      },
    });

    await NotificationService.sendOtp(phone, otp);

    // In dev mode, return OTP directly in response for easy testing
    return {
      otpRef,
      expiresInSeconds: 120,
      ...(env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
    };
  }

  /**
   * Verify OTP and return JWT tokens
   */
  static async verifyOtp(phone: string, otp: string, otpRef: string) {
    const record = await prisma.otpRecord.findUnique({ where: { otpRef } });

    if (!record || record.phone !== phone) {
      throw Errors.validation('Invalid OTP reference');
    }

    if (record.verified) {
      throw Errors.validation('OTP already used');
    }

    if (record.expiresAt < new Date()) {
      throw Errors.validation('OTP expired');
    }

    if (record.attempts >= 3) {
      throw Errors.validation('Too many attempts. Request a new OTP.');
    }

    const isValid = await bcrypt.compare(otp, record.otpHash);

    if (!isValid) {
      // Increment attempts atomically only on failure
      await prisma.otpRecord.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw Errors.validation('Invalid OTP');
    }

    // Atomically mark OTP as verified only if it hasn't been verified yet.
    // This prevents two concurrent requests with the same valid OTP from both succeeding.
    const claimed = await prisma.otpRecord.updateMany({
      where: { id: record.id, verified: false },
      data: { verified: true },
    });
    if (claimed.count === 0) {
      throw Errors.validation('OTP already used');
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { phone } });
    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: { phone },
      });

      // Create coin wallet for new user
      await prisma.coinWallet.create({
        data: { userId: user.id },
      });
    }

    const wallet = await prisma.coinWallet.findUnique({ where: { userId: user.id } });

    const accessToken = jwt.sign(
      { userId: user.id, phone: user.phone, tier: user.tier },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, phone: user.phone, type: 'refresh' },
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
        isNewUser,
      },
    };
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as any;
      if (payload.type !== 'refresh') {
        throw Errors.authRequired();
      }

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || !user.isActive) {
        throw Errors.authRequired();
      }

      const accessToken = jwt.sign(
        { userId: user.id, phone: user.phone, tier: user.tier },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRY }
      );

      return { accessToken, expiresIn: env.JWT_EXPIRY };
    } catch {
      throw Errors.authRequired();
    }
  }

  /**
   * Send OTP for hotel staff login
   */
  static async sendHotelStaffOtp(phone: string) {
    const staff = await prisma.hotelStaff.findFirst({
      where: { phone, isActive: true },
    });

    if (!staff) {
      throw Errors.notFound('Hotel staff account');
    }

    return this.sendOtp(phone);
  }

  /**
   * Verify OTP for hotel staff and return JWT
   */
  static async verifyHotelStaffOtp(phone: string, otp: string, otpRef: string) {
    const record = await prisma.otpRecord.findUnique({ where: { otpRef } });

    if (!record || record.phone !== phone) {
      throw Errors.validation('Invalid OTP reference');
    }

    if (record.verified) throw Errors.validation('OTP already used');
    if (record.expiresAt < new Date()) throw Errors.validation('OTP expired');
    if (record.attempts >= 3) throw Errors.validation('Too many attempts');

    const isValid = await bcrypt.compare(otp, record.otpHash);

    if (!isValid) {
      await prisma.otpRecord.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw Errors.validation('Invalid OTP');
    }

    const claimed = await prisma.otpRecord.updateMany({
      where: { id: record.id, verified: false },
      data: { verified: true },
    });
    if (claimed.count === 0) throw Errors.validation('OTP already used');

    const staff = await prisma.hotelStaff.findFirst({
      where: { phone, isActive: true },
    });

    if (!staff) throw Errors.notFound('Hotel staff account');

    const accessToken = jwt.sign(
      { staffId: staff.id, hotelId: staff.hotelId, phone: staff.phone, role: staff.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRY }
    );

    return { accessToken, staffId: staff.id, hotelId: staff.hotelId, role: staff.role };
  }

  /**
   * Admin login (email + password)
   */
  static async adminLogin(email: string, password: string) {
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
      throw Errors.authRequired();
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      throw Errors.authRequired();
    }

    const accessToken = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role },
      env.JWT_ADMIN_SECRET,
      { expiresIn: env.JWT_EXPIRY }
    );

    return { accessToken, admin: { id: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role } };
  }
}
