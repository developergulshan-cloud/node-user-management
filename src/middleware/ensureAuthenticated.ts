import { Request, Response, NextFunction } from 'express';

export function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const query = req.query as Record<string, unknown>;
    if (req.user && typeof req.user === 'object' && 'id' in req.user) {
      query.userId = String((req.user as { id: number }).id);
    }
    return next();
  }
  return res.status(401).json({ success: false, message: 'Not authenticated' });
}
