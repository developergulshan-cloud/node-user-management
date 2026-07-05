export function generateOtpCode(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';

  for (let index = 0; index < length; index += 1) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }

  return otp;
}

export function isOtpExpired(expiresAt: Date | string): boolean {
  const expiryTime = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return Number.isNaN(expiryTime) || expiryTime <= Date.now();
}
