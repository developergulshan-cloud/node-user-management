// import mysql, { Pool, PoolOptions } from 'mysql2/promise';
// import dotenv from 'dotenv';

// dotenv.config();

// export interface DBConfig {
//   host?: string;
//   port?: number;
//   user?: string;
//   password?: string;
//   database?: string;
//   waitForConnections?: boolean;
//   connectionLimit?: number;
//   queueLimit?: number;
// }

// export class Database {
//   public pool: Pool;

//   constructor(cfg?: DBConfig) {
//     console.log('cfg ', cfg);
//     const config: PoolOptions = {
//       host: cfg?.host || 'localhost',
//       port: cfg?.port || 3306,
//       user: cfg?.user || 'root',
//       password: cfg?.password || '',
//       database: cfg?.database || '',
//       waitForConnections: cfg?.waitForConnections ?? true,
//       connectionLimit: cfg?.connectionLimit ?? 10,
//       queueLimit: cfg?.queueLimit ?? 0,
//     };

//     console.log('config ', config);

//     this.pool = mysql.createPool(config);
//   }

//   public async close(): Promise<void> {
//     await this.pool.end();
//   }
// }

// // Backwards-compatible default instance using environment variables
// export const defaultDatabase = new Database();
// export const pool: Pool = defaultDatabase.pool;



// ------------------------------------------------------------------------------------------
// USER MANGEMENT CODES
// ------------------------------------------------------------------------------------------
import mysql, { Pool, PoolOptions, RowDataPacket, OkPacket, ResultSetHeader } from 'mysql2/promise';

interface DatabaseConfig {
  host?: string;
  user?: string;
  password?: string;
  database?: string;
  waitForConnections?: boolean;
  connectionLimit?: number;
  queueLimit?: number;
}

type QueryResult = RowDataPacket[] | RowDataPacket[][] | OkPacket | OkPacket[] | ResultSetHeader;

class DatabaseConnection {
  private config: PoolOptions;
  private pool: Pool | null = null;

  constructor(config: DatabaseConfig) {
    this.config = {
      port: 3306,
      host: config.host ?? 'localhost',
      user: config.user ?? 'root',
      password: config.password ?? '',
      database: config.database ?? 'user_management',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing database connection...',this.config);
      this.pool = mysql.createPool(this.config);
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS um_users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        reset_token VARCHAR(255),
        reset_token_expiry DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_reset_token (reset_token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS um_sessions (
        session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
        expires INT(11) UNSIGNED NOT NULL,
        data MEDIUMTEXT COLLATE utf8mb4_bin,
        PRIMARY KEY (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createOTPsTable = `
      CREATE TABLE IF NOT EXISTS um_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(10) NOT NULL,
        purpose VARCHAR(50) NOT NULL DEFAULT 'login',
        expires_at DATETIME NOT NULL,
        attempts INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_email_purpose (email, purpose),
        INDEX idx_email (email),
        INDEX idx_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createRolesTable = `
      CREATE TABLE IF NOT EXISTS um_roles (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        permissions JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createUserRolesTable = `
      CREATE TABLE IF NOT EXISTS um_user_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        role_id VARCHAR(36) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_role (user_id, role_id),
        FOREIGN KEY (user_id) REFERENCES um_users(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES um_roles(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_role_id (role_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    if (!this.pool) {
      throw new Error('Pool is not initialized');
    }

    try {
      await this.pool.query(createUsersTable);
      await this.pool.query(createSessionsTable);
      await this.pool.query(createOTPsTable);
      await this.pool.query(createRolesTable);
      await this.pool.query(createUserRolesTable);
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Pool is not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  async query<T extends QueryResult = RowDataPacket[]>(sql: string, params?: unknown[]): Promise<T> {
    if (!this.pool) {
      throw new Error('Pool is not initialized. Call initialize() first.');
    }
    try {
      const [rows] = await this.pool.query<T & RowDataPacket[]>(sql, params);
      return rows as T;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
export { DatabaseConnection, DatabaseConfig, QueryResult };