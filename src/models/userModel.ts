import { ResultSetHeader, RowDataPacket } from 'mysql2';
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
      'SELECT id, email, password, name, is_active, attrs, reset_token, reset_token_expiry, created_at, updated_at FROM um_users WHERE email = ? LIMIT 1',
      [email]
    );
    return rows[0] ?? null;
  }

  public async findUserById(id: number): Promise<UmUser | null> {
    const [rows] = await this.pool.query<(UmUser & RowDataPacket)[]>(
      'SELECT id, email, password, name, is_active, attrs, reset_token, reset_token_expiry, created_at, updated_at FROM um_users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] ?? null;
  }

  public async createGoogleUser(email: string, name: string | null, passwordHash: string): Promise<UmUser> {
    const [result] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO um_users (email, password, name, is_active) VALUES (?, ?, ?, 1)',
      [email, passwordHash, name]
    );
    const user = await this.findUserById(result.insertId);
    if (!user) {
      throw new Error('Google user was created but could not be loaded');
    }
    return user;
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
      'SELECT id, email, otp, purpose, expires_at, attempts FROM um_otps WHERE email = ? AND purpose = ? LIMIT 1',
      [email.toLowerCase(), purpose]
    );

    const record = rows[0];
    if (!record) {
      return false;
    }

    const expiresAt = record.expires_at === null
      ? Number.NaN
      : record.expires_at instanceof Date
        ? record.expires_at.getTime()
        : new Date(record.expires_at).getTime();

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
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

  public async updatePassword(email: string, passwordHash: string): Promise<boolean> {
    const [result] = await this.pool.query(
      'UPDATE um_users SET password = ? WHERE email = ? LIMIT 1',
      [passwordHash, email.toLowerCase()]
    );

    const affectedRows = (result as { affectedRows?: number }).affectedRows ?? 0;
    return affectedRows > 0;
  }

  public async createAuthSession(sessionId: string, userId: number, expiresAt: number): Promise<void> {
    await this.pool.query(
      'INSERT INTO um_sessions (session_id, expires, data) VALUES (?, ?, ?)',
      [sessionId, expiresAt, JSON.stringify({ authToken: true, userId })]
    );
  }

  public async hasAuthSession(sessionId: string, userId: number): Promise<boolean> {
    const [rows] = await this.pool.query<(RowDataPacket & { session_id: string })[]>(
      `SELECT session_id FROM um_sessions
       WHERE session_id = ? AND expires > UNIX_TIMESTAMP() AND JSON_EXTRACT(data, '$.authToken') = true
         AND JSON_EXTRACT(data, '$.userId') = ? LIMIT 1`,
      [sessionId, userId]
    );
    return rows.length > 0;
  }

  public async deleteAuthSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM um_sessions WHERE session_id = ? AND JSON_EXTRACT(data, '$.authToken') = true`,
      [sessionId]
    );
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

export async function createGoogleUser(email: string, name: string | null, passwordHash: string): Promise<UmUser> {
  if (!defaultModel) throw new Error('UserModel not initialized. Call initUserModel(pool) first.');
  return defaultModel.createGoogleUser(email, name, passwordHash);
}

export async function saveOtp(email: string, otp: string, purpose: string = 'login', expiryMinutes: number = 10): Promise<void> {
  if (!defaultModel) throw new Error('UserModel not initialized. Call initUserModel(pool) first.');
  return defaultModel.saveOtp(email, otp, purpose, expiryMinutes);
}

export async function verifyOtp(email: string, otp: string, purpose: string = 'login'): Promise<boolean> {
  if (!defaultModel) throw new Error('UserModel not initialized. Call initUserModel(pool) first.');
  return defaultModel.verifyOtp(email, otp, purpose);
}

export async function updatePassword(email: string, passwordHash: string): Promise<boolean> {
  if (!defaultModel) throw new Error('UserModel not initialized. Call initUserModel(pool) first.');
  return defaultModel.updatePassword(email, passwordHash);
}

export async function createAuthSession(sessionId: string, userId: number, expiresAt: number): Promise<void> {
  if (!defaultModel) throw new Error('UserModel not initialized. Call initUserModel(pool) first.');
  return defaultModel.createAuthSession(sessionId, userId, expiresAt);
}

export async function hasAuthSession(sessionId: string, userId: number): Promise<boolean> {
  if (!defaultModel) throw new Error('UserModel not initialized. Call initUserModel(pool) first.');
  return defaultModel.hasAuthSession(sessionId, userId);
}

export async function deleteAuthSession(sessionId: string): Promise<void> {
  if (!defaultModel) throw new Error('UserModel not initialized. Call initUserModel(pool) first.');
  return defaultModel.deleteAuthSession(sessionId);
}
