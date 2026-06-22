import { Router, Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import { ensureAuthenticated } from '../middleware/ensureAuthenticated';
import { SafeUser } from '../types/user';

const router = Router();

router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(
    'local',
    (err: Error | null, user: SafeUser | false, info: { message: string } | undefined) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({
          success: false,
          message: info?.message || 'Invalid email or password',
        });
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        return res.json({ success: true, user });
      });
    }
  )(req, res, next);
});

router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        return next(destroyErr);
      }
      res.clearCookie('connect.sid');
      return res.json({ success: true, message: 'Logged out' });
    });
  });
});

router.get('/profile', ensureAuthenticated, (req: Request, res: Response) => {
  res.json({ success: true, user: req.user });
});

export default router;
