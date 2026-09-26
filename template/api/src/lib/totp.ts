import { authenticator } from 'otplib';

/** TOTP（两步验证）薄封装 */
export const totp = {
  generateSecret(): string {
    return authenticator.generateSecret();
  },
  keyuri(account: string, secret: string, issuer: string): string {
    return authenticator.keyuri(account, issuer, secret);
  },
  check(token: string, secret: string): boolean {
    try {
      return authenticator.check(token, secret);
    } catch {
      return false;
    }
  },
};
