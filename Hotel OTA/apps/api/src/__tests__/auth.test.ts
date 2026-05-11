import { prisma, cleanTestData } from './helpers';
import { AuthService } from '../services/auth/auth.service';

describe('Auth Service', () => {
  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('should send OTP and return ref with dev OTP', async () => {
    const result = await AuthService.sendOtp('99999000033');

    expect(result.otpRef).toBeDefined();
    expect(result.expiresInSeconds).toBe(120);
    expect(result.devOtp).toBeDefined();
    expect(result.devOtp!.length).toBe(6);
  });

  it('should verify valid OTP and return tokens', async () => {
    const { otpRef, devOtp } = await AuthService.sendOtp('99999000044');

    const result = await AuthService.verifyOtp('99999000044', devOtp!, otpRef);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.phone).toBe('99999000044');
    expect(result.user.isNewUser).toBe(true);
  });

  it('should reject invalid OTP', async () => {
    const { otpRef } = await AuthService.sendOtp('99999000055');

    await expect(
      AuthService.verifyOtp('99999000055', '000000', otpRef)
    ).rejects.toThrow('Invalid OTP');
  });

  it('should reject expired OTP ref', async () => {
    await expect(
      AuthService.verifyOtp('99999000055', '123456', 'invalid_ref')
    ).rejects.toThrow();
  });

  it('should create wallet for new user', async () => {
    const { otpRef, devOtp } = await AuthService.sendOtp('99999000066');
    const result = await AuthService.verifyOtp('99999000066', devOtp!, otpRef);

    const wallet = await prisma.coinWallet.findUnique({
      where: { userId: result.user.id },
    });
    expect(wallet).not.toBeNull();
    expect(wallet!.otaCoinBalancePaise).toBe(0);
  });

  it('should refresh access token', async () => {
    const { otpRef, devOtp } = await AuthService.sendOtp('99999000077');
    const login = await AuthService.verifyOtp('99999000077', devOtp!, otpRef);

    const refreshed = await AuthService.refreshToken(login.refreshToken);
    expect(refreshed.accessToken).toBeDefined();
    expect(refreshed.expiresIn).toBeGreaterThan(0);
  });

  it('should authenticate admin with email/password', async () => {
    const result = await AuthService.adminLogin('admin@ota.com', 'admin123');

    expect(result.accessToken).toBeDefined();
    expect(result.admin.email).toBe('admin@ota.com');
    expect(result.admin.role).toBe('super_admin');
  });

  it('should reject wrong admin password', async () => {
    await expect(
      AuthService.adminLogin('admin@ota.com', 'wrongpassword')
    ).rejects.toThrow();
  });
});
