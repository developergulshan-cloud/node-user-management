# um-auth-api

Small Express + TypeScript API with `passport-local` authentication. Sessions
are persisted in your existing `um_sessions` MySQL table via
`express-mysql-session`. User data is read from your existing `um_users`
table (passwords assumed to be bcrypt hashes).

## Setup

```bash
npm install
cp .env.example .env   # then fill in your DB credentials
npm run dev
```

Server starts on `http://localhost:3000` (or `PORT` from `.env`).

## Endpoints

### POST /api/auth/login
Body (JSON or form-encoded):
```json
{ "email": "user@example.com", "password": "secret" }
```
On success, sets a session cookie (`connect.sid`) and returns:
```json
{ "success": true, "user": { "id": 1, "email": "...", "first_name": "...", "last_name": "..." } }
```
On failure: `401` with `{ "success": false, "message": "Invalid email or password" }`.

### GET /api/auth/profile
Requires a valid session cookie (sent automatically by the browser/client
after login). Returns the logged-in user:
```json
{ "success": true, "user": { "id": 1, "email": "...", "first_name": "...", "last_name": "..." } }
```
Returns `401` if not authenticated.

### POST /api/auth/logout
Destroys the session and clears the cookie.

## Testing with curl

```bash
# Login (save cookie to file)
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"someone@example.com","password":"yourpassword"}'

# Get profile using saved cookie
curl -i -b cookies.txt http://localhost:3000/api/auth/profile

# Logout
curl -i -b cookies.txt -X POST http://localhost:3000/api/auth/logout
```

## Notes on um_sessions

- `express-mysql-session` is configured with `createDatabaseTable: false`
  and an explicit column mapping (`session_id`, `expires`, `data`) so it
  reuses your table as-is rather than creating its own schema.
- `expires` is stored as a Unix timestamp in seconds, which matches your
  `int unsigned` column.
- A background sweep (`checkExpirationInterval`) clears expired rows every
  15 minutes.

## Notes on security

- `cookie.secure` is automatically `true` when `NODE_ENV=production` — this
  requires the app to be served over HTTPS (or behind a TLS-terminating
  proxy with `app.set('trust proxy', 1)` added if needed).
- Passwords are never included in any API response (`SafeUser` type strips
  it before it reaches `req.user` or the session).
- Only `user.id` is stored in the session row; the full user is rehydrated
  from `um_users` on each request via `passport.deserializeUser`.

## Project structure

```
src/
  app.ts                  # Express app entrypoint
  config/
    db.ts                 # mysql2 pool
    session.ts             # express-mysql-session store (um_sessions)
    passport.ts            # LocalStrategy + serialize/deserialize
  middleware/
    ensureAuthenticated.ts
  models/
    userModel.ts            # queries against um_users
  routes/
    authRoutes.ts          # /login, /logout, /profile
  types/
    user.ts                # UmUser / SafeUser types
    express.d.ts           # augments Express.User
    express-mysql-session.d.ts  # ambient module types
```
