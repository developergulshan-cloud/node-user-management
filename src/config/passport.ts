import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { createGoogleUser, findUserByEmail, findUserById } from '../models/userModel';
import { toSafeUser } from '../types/user';

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function configureGoogleStrategy(): void {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID && !clientSecret) {
    return;
  }
  if (!clientID || !clientSecret) {
    throw new Error('Both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured');
  }

  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
        scope: ['profile', 'email'],
        state: true,
        passReqToCallback: true,
      },
      async (req, _accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile._json.email;
          if (profile._json.email_verified !== true || typeof email !== 'string' || !email) {
            return done(null, false, { message: 'A verified Google email address is required' });
          }

          const mode = req.session.googleAuthMode;
          if (!mode) {
            return done(null, false, { message: 'Start Google login or signup before completing authentication' });
          }

          const normalizedEmail = email.toLowerCase();
          let user = await findUserByEmail(normalizedEmail);
          if (!user) {
            if (mode === 'login') {
              return done(null, false, { message: 'No account found for this Google email' });
            }

            const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
            try {
              user = await createGoogleUser(normalizedEmail, profile.displayName || null, passwordHash);
            } catch (error) {
              const isDuplicateEmail = typeof error === 'object'
                && error !== null
                && 'code' in error
                && error.code === 'ER_DUP_ENTRY';
              if (!isDuplicateEmail) {
                throw error;
              }

              // Another OAuth callback may have created this email after our initial lookup.
              user = await findUserByEmail(normalizedEmail);
              if (!user) {
                throw error;
              }
            }
          } else if (mode === 'signup') {
            return done(null, false, { message: 'An account already exists for this Google email; use Google login' });
          }
          if (user.is_active === 0) {
            return done(null, false, { message: 'Account is inactive' });
          }

          return done(null, toSafeUser(user));
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await findUserByEmail(email);

        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        if (user.is_active === 0) {
          return done(null, false, { message: 'Account is inactive' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, toSafeUser(user));
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

// Only id goes into the session row (um_sessions.data)
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await findUserById(id);
    if (!user) {
      return done(null, false);
    }
    done(null, toSafeUser(user));
  } catch (err) {
    done(err as Error);
  }
});

export default passport;
