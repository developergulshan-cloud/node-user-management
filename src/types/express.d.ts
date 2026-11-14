import { SafeUser } from './user';

declare global {
  namespace Express {
    // Makes req.user typed as SafeUser instead of `any`
    interface User extends SafeUser {}
  }
}

declare module 'express-session' {
  interface SessionData {
    googleAuthMode?: 'login' | 'signup';
  }
}

export {};
