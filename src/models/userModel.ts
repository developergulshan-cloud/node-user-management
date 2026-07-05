import { RowDataPacket } from 'mysql2';
import { Pool } from 'mysql2/promise';
import { UmUser } from '../types/user';

interface OtpRecord extends RowDataPacket {
  id: number;
  email: string;
  otp: string;
  purpose: string;
  expires_at: Date | string | null;
  attempts: number;
}

export class UserModel {
  constructor(private pool: Pool) { }

  public async findUserByEmail(email: string): Promise<UmUser | null> {
    const [rows] = await this.pool.query<(UmUser & RowDataPacket)[]>(
      'SELECT id, email, password, first_name, last_name, is_active, reset_token, reset_token_expiry, created_at, updated_at FROM um_users WHERE email = ? LIMIT 1',
      [email]
    );
    return rows[0] ?? null;
  }

  public async findUserById(id: number): Promise<UmUser | null> {
    const [rows] = await this.pool.query<(UmUser & RowDataPacket)[]>(
      'SELECT id, email, password, first_name, last_name, is_active, reset_token, reset_token_expiry, created_at, updated_at FROM um_users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] ?? null;
  }

  public async saveOtp(email: string, otp: string, purpose: string = 'login', expiryMinutes: number = 10): Promise<void> {
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);


    await this.pool.query(
      `INSERT INTO um_otps (email, otp, purpose, expires_at, attempts)
       VALUES (?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE otp = VALUES(otp), expires_at = VALUES(expires_at), attempts = 0, created_at = CURRENT_TIMESTAMP`,
      [email.toLowerCase(), otp, purpose, expiresAt]
    );
  }

  public async verifyOtp(email: string, otp: string, purpose: string = 'login'): Promise<boolean> {
    const [rows] = await this.pool.query<(OtpRecord & RowDataPacket)[]>(
      'SELECT id, email, otp, purpose, expires_at, attempts FROM um_otps WHERE email = ? LIMIT 1',
      [email.toLowerCase()]
    );

    const record: any = rows[0];
    if (!record) {
      return false;
    }


    const expiresAt = record.expires_at.getTime();

    if (expiresAt <= Date.now()) {
      await this.pool.query('DELETE FROM um_otps WHERE id = ?', [record.id]);
      return false;
    }

    if (record.attempts >= 3) {
      await this.pool.query('DELETE FROM um_otps WHERE id = ?', [record.id]);
      return false;
    }

    if (record.otp !== otp) {
      await this.pool.query('UPDATE um_otps SET attempts = attempts + 1 WHERE id = ?', [record.id]);
      return false;
    }

    await this.pool.query('DELETE FROM um_otps WHERE id = ?', [record.id]);
    return true;
  }
}

let defaultModel: UserModel | null = null;

export function initUserModel(pool: Pool) {
  defaultModel = new UserModel(pool);
}

export async function findUserByEmail(email: string): Promise<UmUser | null> {
  if (!defaultModel) throw new Error('UserModel not initialized. Call initUserModel(pool) first.');
  return defaultModel.findUserByEmail(email);
}

export async function findUserById(id: number): Promise<UmUser | null> {
  if (!defaultModel) throw new Error('UserModel not initialized. Call initUserModel(pool) first.');
  return defaultModel.findUserById(id);
}

export async function saveOtp(email: string, otp: string, purpose: string = 'login', expiryMinutes: number = 10): Promise<void> {
  if (!defaultModel) throw new Error('UserModel not initialized. Call initUserModel(pool) first.');
  return defaultModel.saveOtp(email, otp, purpose, expiryMinutes);
}

export async function verifyOtp(email: string, otp: string, purpose: string = 'login'): Promise<boolean> {
  if (!defaultModel) throw new Error('UserModel not initialized. Call initUserModel(pool) first.');
  return defaultModel.verifyOtp(email, otp, purpose);
}
