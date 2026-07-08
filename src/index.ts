import { AppServer } from './app';
import authRoutes from './routes/authRoutes';
import * as authMiddleware from './middleware/auth';
import { ensureAuthenticated } from './middleware/ensureAuthenticated';
import { SessionStore } from './config/session';
import { DatabaseConfig, DatabaseConnection } from './config/db';
import type { SessionConfig } from './types/user';
import {
  isAuthenticated,
  isNotAuthenticated,
  isActive,
  csrfProtection,
  addCsrfToken,
  csrfErrorHandler,
  createRateLimiter,
  sanitizeInput,
  securityHeaders,
  validateEmail,
  validatePassword
} from './middleware/auth';

export {
  isAuthenticated,
  isNotAuthenticated,
  isActive,
  csrfProtection,
  addCsrfToken,
  csrfErrorHandler,
  createRateLimiter,
  sanitizeInput,
  securityHeaders,
  validateEmail,
  validatePassword
}
export { AppServer, authRoutes, authMiddleware, ensureAuthenticated, SessionStore, DatabaseConfig, DatabaseConnection };
export * from './middleware/auth';
export * from './types/user';

export async function createApp(databaseConfig: DatabaseConfig, sessionConfig?: SessionConfig) {
  const server = new AppServer(databaseConfig, sessionConfig);
  await server.init();
  return server.app;
}

export default AppServer;
