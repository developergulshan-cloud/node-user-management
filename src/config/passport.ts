import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { findUserByEmail, findUserById } from '../models/userModel';
import { toSafeUser } from '../types/user';

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
