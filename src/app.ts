import express, { Application, Request, Response } from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { DatabaseConfig, DatabaseConnection } from './config/db';

import { SessionStore } from './config/session';
import { initUserModel } from './models/userModel';
import passport from './config/passport';
import authRoutes from './routes/authRoutes';
import dabApi from 'dynamic-api-builder-js';
import { DabConfig, DabRouterOptions } from 'dynamic-api-builder-js';
import cookieParser from 'cookie-parser';
// const dabAPI = require('dynamic-api-builder-js');
const mysqlapis = require('./api-config.json');


dotenv.config();
export class AppServer {
  public app: Application;
  public port: number | string;
  private isProd: boolean;
  private sessionStore: any;
  private dbConnection?: DatabaseConnection;

  constructor(private databaseConfig?: DatabaseConfig) {
    this.app = express();
    this.port = 3000;
    this.isProd = false;
    // DB and session store initialization is done in `init()`
  }

  public async init(): Promise<void> {
    this.dbConnection = new DatabaseConnection(this.databaseConfig || {} as DatabaseConfig);
    await this.dbConnection.initialize();

    this.sessionStore = new SessionStore(this.dbConnection.getPool()).getStore();

    // Initialize user model with the same DB pool
    initUserModel(this.dbConnection.getPool());

    this.configureMiddleware();
    this.configureRoutes();
    this.configureApis();
  }

  private configureMiddleware() {
    this.app.use(express.json());
    this.app.use(cookieParser());
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use(
      cors({
        origin: true,
        credentials: true,
      })
    );

    this.app.use(
      session({
        name: 'connect.sid',
        secret: process.env.SESSION_SECRET || 'dev-secret',
        store: this.sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: this.isProd,
          maxAge: 24 * 60 * 60 * 1000,
          sameSite: 'lax',
        },
      })
    );

    this.app.use(passport.initialize());
    this.app.use(passport.session());
  }

  private configureRoutes() {
    this.app.use('/api/auth', authRoutes);

    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ success: true, message: 'OK' });
    });
  }

  private configureApis() {
    const mysqlconfig: DabConfig = {
      type: 'mysql',
      database: {
        host: this.databaseConfig?.host,
        user: this.databaseConfig?.user,
        password: this.databaseConfig?.password,
        database: this.databaseConfig?.database,
        port: 3306,
      },
      apis: mysqlapis.apis,
    };

    const mysqlApiConfig = dabApi(mysqlconfig).router;
    this.app.use('/api', mysqlApiConfig);
  }

  public listen(callback?: () => void) {
    const p = this.port;
    this.app.listen(p, () => {
      console.log(`Server running on http://localhost:${p}`);
      if (callback) callback();
    });
  }
}

// Preserve existing startup behavior when file is run directly
if (require.main === module) {
  let databaseConfig: DatabaseConfig = {
    "host": "127.0.0.1",
    "user": "gulshan",
    "password": "Gulshan@814144",
    "database": "user_management",
  };
  const server = new AppServer(databaseConfig);
  (async () => {
    try {
      await server.init();
      server.listen();
    } catch (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  })();
}
