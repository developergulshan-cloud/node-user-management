import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import * as bcrypt from 'bcryptjs';
import { findUserByEmail, findUserById } from '../models/userModel';
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
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile._json.email;
          if (profile._json.email_verified !== true || typeof email !== 'string' || !email) {
            return done(null, false, { message: 'A verified Google email address is required' });
          }

          const user = await findUserByEmail(email.toLowerCase());
          if (!user) {
            return done(null, false, { message: 'No account found for this Google email' });
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
