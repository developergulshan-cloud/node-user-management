import { RowDataPacket } from 'mysql2';
import { Pool } from 'mysql2/promise';
import { UmUser } from '../types/user';

export class UserModel {
  constructor(private pool: Pool) {}

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
