import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
// import { pool } from './db';

const MySQLStore = MySQLStoreFactory(session);

// Reuses the existing mysql2 pool. createDatabaseTable is false because
// um_sessions already exists with its own schema/columns.
export class SessionStore {
  public store: any;

  constructor(dbPool: any) {
    this.store = new MySQLStore(
      {
        schema: {
          tableName: 'um_sessions',
          columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data',
          },
        },
        createDatabaseTable: false,
        clearExpired: true,
        checkExpirationInterval: 15 * 60 * 1000, // 15 min
      },
      dbPool
    );

    this.store.on?.('error', (err: Error) => {
      console.error('Session store error:', err);
    });
  }

  public getStore() {
    return this.store;
  }
}

// Default instance kept for backwards compatibility with existing imports
// export const sessionStore = new SessionStore().getStore();
