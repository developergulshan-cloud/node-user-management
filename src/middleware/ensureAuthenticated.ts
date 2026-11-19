import { isAuthenticated } from './auth';
import { Request, Response, NextFunction } from 'express';

export function ensureAuthenticated(req: Request, res: Response, next: NextFunction): void {
  isAuthenticated(req, res, (error?: unknown) => {
    if (error) return next(error);
    const query = req.query as Record<string, unknown>;
    if (req.user && typeof req.user === 'object' && 'id' in req.user) {
      query.userId = String(req.user.id);
    }
    next();
  });
}
