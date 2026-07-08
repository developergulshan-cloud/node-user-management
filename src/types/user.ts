export interface UmUser {
  id: number;
  email: string;
  password: string;
  name: string | null;

  is_active: number | null;
  reset_token: string | null;
  reset_token_expiry: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
}

// Shape exposed to the client / stored in session — never includes password
export interface SafeUser {
  id: number;
  email: string;
  name: string | null;
}

export interface SessionConfig {
  name?: string;
  secret?: string;
  resave?: boolean;
  saveUninitialized?: boolean;
  cookie?: {
    httpOnly?: boolean;
    secure?: boolean;
    maxAge?: number;
    sameSite?: 'strict' | 'lax' | 'none';
  };
}

export function toSafeUser(user: UmUser): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}
