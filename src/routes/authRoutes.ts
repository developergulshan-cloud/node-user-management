import { Router, Request, Response, NextFunction } from 'express';
import * as bcrypt from 'bcryptjs';
import passport, { isGoogleOAuthConfigured } from '../config/passport';
import { deleteAuthSession, findUserByEmail, saveOtp, updatePassword, verifyOtp } from '../models/userModel';
import { SafeUser, toSafeUser } from '../types/user';
import { isAuthenticated, sanitizeInput, isNotAuthenticated, validateEmail, validatePassword } from '../middleware/auth';
import EmailService from '../sevices/emailService';
import { generateOtpCode } from '../utils/otp';
import { createAuthToken, readAuthToken } from '../utils/authToken';

const router = Router();

const startGoogleAuth = (mode: 'login' | 'signup') => [
  isNotAuthenticated,
  (req: Request, res: Response, next: NextFunction) => {
    if (!isGoogleOAuthConfigured()) {
      return res.status(503).json({ success: false, message: 'Google login is not configured' });
    }
    req.session.googleAuthMode = mode;
    return req.session.save((error) => {
      if (error) {
        return next(error);
      }
      return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
    });
  },
];

router.get('/google', ...startGoogleAuth('login'));
router.get('/google/login', ...startGoogleAuth('login'));
router.get('/google/signup', ...startGoogleAuth('signup'));

router.get('/google/callback',
  (req: Request, res: Response, next: NextFunction) => {
    if (!isGoogleOAuthConfigured()) {
      return res.status(503).json({ success: false, message: 'Google login is not configured' });
    }

    return passport.authenticate(
      'google',
      (err: Error | null, user: SafeUser | false, info: { message: string } | undefined) => {
        req.session.googleAuthMode = undefined;
        if (err) {
          return req.session.save((saveError) => next(saveError || err));
        }
        if (!user) {
          return req.session.save((saveError) => {
            if (saveError) {
              return next(saveError);
            }
            return res.status(401).json({
              success: false,
              message: info?.message || 'Google authentication failed',
            });
          });
        }

        return req.session.save((saveError) => {
            if (saveError) {
              return next(saveError);
            }
            return createAuthToken(user.id)
              .then((token) => res.json({ success: true, user, token }))
              .catch(next);
          });
      }
    )(req, res, next);
  }
);

router.post('/login',
  sanitizeInput,
  isNotAuthenticated,
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      'local',
      (err: Error | null, user: SafeUser | false, info: { message: string } | undefined) => {
        if (err) {
          return next(err.message ? new Error(err.message) : 'An error occurred during authentication');
        }
        if (!user) {
          return res.status(401).json({
            success: false,
            message: info?.message || 'Invalid email or password',
          });
        }

        return createAuthToken(user.id)
          .then((token) => res.json({ success: true, user, token }))
          .catch(next);
      }
    )(req, res, next);
  });

router.post('/request-otp',
  sanitizeInput,
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
      await emailService.sendOTPEmail(email, otp, user.name ?? undefined);

      return res.json({ success: true, message: 'OTP sent to your email' });
    } catch (error) {
      return next(error);
    }
  });

router.post('/forgot-password',
  sanitizeInput,
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

      const otp = generateOtpCode();
      await saveOtp(email, otp, 'reset', 10);

      const emailService = new EmailService();
      await emailService.sendOTPForgotPassword(email, otp, user.name ?? undefined, 10);

      return res.json({ success: true, message: 'Password reset OTP sent to your email' });
    } catch (error) {
      return next(error);
    }
  });

router.post('/reset-password-with-otp',
  sanitizeInput,
  isNotAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

      if (!validateEmail(email)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
      }

      if (!otp) {
        return res.status(400).json({ success: false, message: 'OTP is required' });
      }

      if (!validatePassword(password)) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and include uppercase, lowercase, and a number' });
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return res.status(404).json({ success: false, message: 'No account found for that email' });
      }

      const isValidOtp = await verifyOtp(email, otp, 'reset');
      if (!isValidOtp) {
        return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const updated = await updatePassword(email, passwordHash);

      if (!updated) {
        return res.status(500).json({ success: false, message: 'Failed to reset password' });
      }

      return res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
      return next(error);
    }
  });

router.post('/login-with-otp',
  sanitizeInput,
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
      const token = await createAuthToken(safeUser.id);
      return res.json({ success: true, user: safeUser, token });
    } catch (error) {
      return next(error);
    }
  });

router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const match = req.get('Authorization')?.match(/^Bearer\s+(\S+)$/i);
    const claims = match ? readAuthToken(match[1], true) : null;
    if (!claims) {
      return res.status(401).json({ success: false, message: 'A valid bearer token is required to log out' });
    }
    await deleteAuthSession(claims.sessionId);
    return res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    return next(error);
  }
});

router.get('/profile', isAuthenticated, (req: Request, res: Response) => {
  res.json({ success: true, user: req.user });
});

export default router;
