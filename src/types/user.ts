export interface UmUser {
  id: number;
  email: string;
  password: string;
  first_name: string | null;
  last_name: string | null;
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
  first_name: string | null;
  last_name: string | null;
}

export function toSafeUser(user: UmUser): SafeUser {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  };
}
