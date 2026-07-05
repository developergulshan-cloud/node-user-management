import { Router, Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import { findUserByEmail, saveOtp, verifyOtp } from '../models/userModel';
import { SafeUser, toSafeUser } from '../types/user';
import { isAuthenticated, csrfProtection, sanitizeInput, isNotAuthenticated, validateEmail } from '../middleware/auth';
import EmailService from '../sevices/emailService';
import { generateOtpCode } from '../utils/otp';

const router = Router();

// Get CSRF token
router.get('/csrf-token', csrfProtection, (req, res) => {
  res.json({
    success: true,
    csrfToken: req.csrfToken()
  });
});

router.post('/login',
  sanitizeInput,
  csrfProtection,
  isNotAuthenticated,
  (req: Request, res: Response, next: NextFunction) => {
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

router.post('/request-otp',
  sanitizeInput,
  csrfProtection,
  isNotAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

      if (!validateEmail(email)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return res.status(404).json({ success: false, message: 'No account found for that email' });
      }

      if (user.is_active === 0) {
        return res.status(403).json({ success: false, message: 'Account is inactive' });
      }

      const otp = generateOtpCode();
      await saveOtp(email, otp);

      const emailService = new EmailService();
      await emailService.sendOTPEmail(email, otp, user.first_name ?? undefined);

      return res.json({ success: true, message: 'OTP sent to your email' });
    } catch (error) {
      return next(error);
    }
  });

router.post('/login-with-otp',
  sanitizeInput,
  csrfProtection,
  isNotAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';

      if (!validateEmail(email)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
      }

      if (!otp) {
        return res.status(400).json({ success: false, message: 'OTP is required' });
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or OTP' });
      }

      if (user.is_active === 0) {
        return res.status(403).json({ success: false, message: 'Account is inactive' });
      }

      const isValidOtp = await verifyOtp(email, otp);
      if (!isValidOtp) {
        return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
      }

      const safeUser = toSafeUser(user);
      req.logIn(safeUser, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        return res.json({ success: true, user: safeUser });
      });
    } catch (error) {
      return next(error);
    }
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

router.get('/profile', isAuthenticated, (req: Request, res: Response) => {
  res.json({ success: true, user: req.user });
});

export default router;
