declare module 'express-mysql-session' {
  import session from 'express-session';
  import { Pool } from 'mysql2/promise';

  interface MySQLStoreOptions {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    schema?: {
      tableName?: string;
      columnNames?: {
        session_id?: string;
        expires?: string;
        data?: string;
      };
    };
    [key: string]: any;
  }

  export default function MySQLStoreFactory(
    sessionModule: typeof session
  ): {
    new (options: MySQLStoreOptions, connection?: Pool): session.Store;
  };
}
