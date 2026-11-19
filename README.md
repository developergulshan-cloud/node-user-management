# User Management API

A Node.js and TypeScript API for user authentication and management.
It uses Express, Passport local and Google authentication, MySQL, and
signed bearer tokens. The authentication routes support password login,
Google signup and login, email OTP login, and password reset by email OTP.

## Features

- Email and password authentication using bcrypt password hashes.
- Google OAuth signup and login with verified Google email addresses.
- Header-based authentication with signed bearer tokens.
- OTP login and OTP-based password reset.
- A MySQL schema initializer for the user-management tables in the ERD.
- A JSON API configuration for CRUD and other operations (see
  [Dynamic API configuration](#dynamic-api-configuration)).

## Requirements

- Node.js 20 or later.
- npm.
- MySQL with a database and a user that can create tables and indexes.
- An SMTP account for OTP email delivery.
- A Google OAuth 2.0 web client to enable Google login (optional).

## Getting started

Install dependencies:

```powershell
npm install
```

Create a local `.env` file and edit it with your database, session, and email
settings:

```powershell
Copy-Item .env.example .env
```

Start the development server:

```powershell
npm run dev
```

The app initializes the tables if they do not already exist, then listens on
`http://localhost:3000`. Check that it is responding:

```powershell
curl.exe http://localhost:3000/health
```

Expected response:

```json
{"success":true,"message":"OK"}
```

### Environment variables

| Variable | Purpose | Default / example |
|---|---|---|
| `DB_HOST` | MySQL hostname | `127.0.0.1` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | Set locally |
| `DB_NAME` | MySQL database name | `user_management` |
| `AUTH_TOKEN_SECRET` | Secret used to sign bearer tokens | Set a long, unique secret |
| `SESSION_SECRET` | Secret used for Google OAuth state sessions | Set a long, unique secret |
| `NODE_ENV` | Environment name | `development` |
| `PORT` | Server port setting shown in `.env.example` | The current app still listens on `3000`; this variable is not read yet |
| `SMTP_HOST` | SMTP server hostname | Set for OTP email |
| `SMTP_PORT` | SMTP server port | Set for OTP email |
| `SMTP_USER` | SMTP username | Set for OTP email |
| `SMTP_PASS` | SMTP password | Set for OTP email |
| `EMAIL_FROM` | Sender address for OTP email | Set for OTP email |
| `APP_URL` | Application URL used by email templates | Set for OTP email |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web client secret | Optional |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL registered with Google | `http://localhost:3000/api/auth/google/callback` |

Use your own values in `.env`; do not commit credentials. The app currently
falls back to `dev-secret` if `SESSION_SECRET` is not set, so configure a
strong secret before deploying.

### Configure Google OAuth

1. Create a **Web application** OAuth client in the Google Cloud Console and
   configure its OAuth consent screen.
2. Add the exact value of `GOOGLE_CALLBACK_URL` to the client's **Authorized
   redirect URIs**. For local development, use
   `http://localhost:3000/api/auth/google/callback`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`, and set
   `GOOGLE_CALLBACK_URL` if the server is not using the local development URL.
4. Restart the server. Google login is disabled when both client credentials
   are absent; if only one is set, startup fails with a configuration error.

## API endpoints

All authentication endpoints are prefixed with `/api/auth`.
JSON request bodies should use `Content-Type: application/json`. Successful
password, OTP, and Google sign-in responses include a signed `token`. Send it
on protected requests as `Authorization: Bearer <token>`. Tokens expire after
24 hours; logout invalidates the token and deletes its session row. Google OAuth
uses a temporary session for its state handshake; API authentication is
validated from the Authorization header.
Google signup and login are browser-based OAuth redirects rather than JSON
requests. Open `/api/auth/google/signup` to create an account or
`/api/auth/google/login` to sign in, complete Google's consent/sign-in, and the
callback returns the signed-in user and bearer token as JSON. Signup rejects an
account; login rejects an email that has no account. Both require a verified
Google email, and inactive accounts are rejected. `/api/auth/google` remains
available as an alias for Google login.

| Method | Path | Description | Authentication |
|---|---|---|---|
| `GET` | `/health` | Health check | Public |
| `GET` | `/api/auth/google/signup` | Start Google OAuth signup | Public; OAuth state checked |
| `GET` | `/api/auth/google/login` | Start Google OAuth login | Public; OAuth state checked |
| `GET` | `/api/auth/google` | Legacy alias for Google OAuth login | Public; OAuth state checked |
| `GET` | `/api/auth/google/callback` | Complete Google signup/login and return token | Google OAuth callback |
| `POST` | `/api/auth/login` | Sign in with email and password | Public |
| `POST` | `/api/auth/request-otp` | Email an OTP for login | Public |
| `POST` | `/api/auth/login-with-otp` | Sign in with an emailed login OTP | Public |
| `POST` | `/api/auth/forgot-password` | Email an OTP for password reset | Public |
| `POST` | `/api/auth/reset-password-with-otp` | Reset password using an OTP | Public |
| `GET` | `/api/auth/profile` | Return the current authenticated user | Bearer token required |
| `POST` | `/api/auth/logout` | Revoke the bearer token and delete its session row | Bearer token required |

Health check:

```powershell
curl.exe -i "$BaseUrl/health"
```

### Password login

The response includes a bearer token for later requests.

```powershell
curl.exe -i -X POST "$BaseUrl/api/auth/login" -H "Content-Type: application/json" --data-raw '{"email":"user@example.com","password":"YourPassword1"}'
```

Example success response:

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "Example User"
  },
  "token": "<signed bearer token>"
}
```

The returned user object does not contain the password. Invalid credentials
return `401`.

### Google signup and login

Open the relevant URL in a browser to start Google's sign-in and consent flow:

```text
http://localhost:3000/api/auth/google/signup
http://localhost:3000/api/auth/google/login
```

After successful authentication, Google redirects back to
`/api/auth/google/callback`. The callback verifies the OAuth state and email,
then returns:

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "Example User"
  },
  "token": "<signed bearer token>"
}
```

Signup creates an active account only when the verified email has no matching
user; login only succeeds for an existing account. Inactive users and Google
accounts without a verified email cannot sign in. cURL can request the initial
redirect, but completing Google consent requires an interactive browser. Use
the returned token for subsequent requests:

```powershell
curl.exe -i "$BaseUrl/api/auth/profile" -H "Authorization: Bearer <token>"
```

### Get the current profile

Send the bearer token:

```powershell
curl.exe -i "$BaseUrl/api/auth/profile" -H "Authorization: Bearer <token>"
```

An unauthenticated request returns `401`.

### Request a login OTP

This sends an OTP to the email address belonging to an active user. The
default OTP expiry is 10 minutes.

```powershell
curl.exe -i -X POST "$BaseUrl/api/auth/request-otp" -H "Content-Type: application/json" --data-raw '{"email":"user@example.com"}'
```

### Log in with an OTP

Use the OTP received by email:

```powershell
curl.exe -i -X POST "$BaseUrl/api/auth/login-with-otp" -H "Content-Type: application/json" --data-raw '{"email":"user@example.com","otp":"123456"}'
```

OTP verification rejects expired codes and allows at most three failed
attempts before deleting the code.

### Reset a forgotten password

First request a password-reset OTP:

```powershell
curl.exe -i -X POST "$BaseUrl/api/auth/forgot-password" -H "Content-Type: application/json" --data-raw '{"email":"user@example.com"}'
```

Then submit the OTP and a new password. The password must be at least eight
characters and contain an uppercase letter, a lowercase letter, and a number:

```powershell
curl.exe -i -X POST "$BaseUrl/api/auth/reset-password-with-otp" -H "Content-Type: application/json" --data-raw '{"email":"user@example.com","otp":"123456","password":"NewPassword1"}'
```

### Log out

```powershell
curl.exe -i -X POST "$BaseUrl/api/auth/logout" -H "Authorization: Bearer <token>"
```

The token's session record is deleted from `um_sessions`, so it cannot be used
again. Discard the token on the client as well.

## Database schema

At startup, `DatabaseConnection` runs `CREATE TABLE IF NOT EXISTS` for these
ERD tables:

| Table | Purpose and columns |
|---|---|
| `um_users` | User accounts: auto-increment `BIGINT` ID, unique email, password hash, name, active flag, optional JSON attributes, reset-token fields, and timestamps. |
| `um_sessions` | Express sessions: auto-increment ID, unique session ID, expiry, session data, and the ERD's `um_sessionscol` field. |
| `um_otps` | Email OTPs: email, code, purpose, expiry, attempt count, and creation time; a unique email/purpose key supports separate login and reset codes. |
| `um_roles` | Roles with a unique name, optional description, and timestamps. |
| `um_policies` | Policies with a name, effect, and optional JSON conditions. |
| `um_permissions` | Permission name and optional `um_roles_id`, referencing `um_roles.id`. |
| `um_user_roles` | User-to-role assignments with optional `um_policies_id`; foreign keys reference users, roles, and policies. |

The session store reuses the app's MySQL connection pool and maps its session
columns to `session_id`, `expires`, and `data`. Expired sessions are checked
every 15 minutes.

`CREATE TABLE IF NOT EXISTS` only creates missing tables; it does not migrate
or alter tables that already exist. Apply schema changes to an existing
database with a migration before deploying if its tables do not match the ERD.

## Project structure

```text
.
├── .env.example                  # Environment variable template
├── build.js                      # esbuild configuration for the app bundle
├── package.json                  # Dependencies and npm scripts
├── tsconfig.json                 # TypeScript compiler settings
└── src/
    ├── api-config.json           # Dynamic API Builder endpoint definitions
    ├── app.ts                    # Express app, middleware, startup, health route
    ├── constant.ts               # Legacy/commented database settings
    ├── index.ts                  # Library exports and createApp() helper
    ├── config/
    │   ├── db.ts                 # MySQL pool and ERD table initialization
    │   ├── passport.ts           # Local strategy and session serialization
    │   └── session.ts            # MySQL-backed Express session store
    ├── middleware/
    │   ├── auth.ts               # Authentication, CSRF, validation, sanitizing
    │   └── ensureAuthenticated.ts # Auth check that adds userId to the query
    ├── models/
    │   └── userModel.ts          # User lookup, OTP, and password database queries
    ├── routes/
    │   └── authRoutes.ts         # Authentication, OTP, profile, and logout routes
    ├── sevices/
    │   └── emailService.ts       # SMTP email delivery (directory spelling as-is)
    ├── types/
    │   ├── express-mysql-session.d.ts # Types for express-mysql-session
    │   ├── express.d.ts          # Express user type augmentation
    │   └── user.ts               # User, safe-user, and session types
    └── utils/
        └── otp.ts                # OTP code generation and expiry helper
```

## Important packages

### Runtime dependencies

- **express** — HTTP server and routing.
- **mysql2** — MySQL connection pool and SQL driver.
- **express-session** and **express-mysql-session** — Session middleware and
  MySQL session persistence.
- **passport** and **passport-local** — Local email/password authentication and
  session integration.
- **passport-google-oauth20** — Google OAuth 2.0 authentication strategy.
- **bcryptjs** — Password hash verification and password-reset hashing.
- **csurf** — Optional CSRF middleware exported for consumers.
- **nodemailer** — SMTP delivery of login and password-reset OTPs.
- **dotenv** — Loads local environment variables from `.env`.
- **cors** — Cross-origin request handling.
- **cookie-parser** — Cookie parsing for the OAuth state session middleware.
- **dynamic-api-builder-js** — Builds a router from `src/api-config.json`.

### Development dependencies

- **typescript** and **@types/** packages — TypeScript compiler and type
  definitions.
- **ts-node-dev** — Restarts the TypeScript development server when files
  change.
- **esbuild** — Bundles the app for the build script.

## NPM scripts

| Command | Description |
|---|---|
| `npm install` | Install dependencies. |
| `npm run dev` | Run `src/app.ts` with `ts-node-dev` and restart on changes. |
| `npm run build` | Bundle `src/app.ts` to `dist/app.js` with esbuild. |
| `npm start` | Currently configured to run `dist/index.js`. |

**Build/start note:** `build.js` currently emits `dist/app.js`, while the
`start` script and the `main` field in `package.json` point to `dist/index.js`.
As a result, `npm start` will not run the bundle produced by `npm run build`
unless those paths are aligned.

## Dynamic API configuration

`src/api-config.json` contains CRUD, transaction, and function endpoint
definitions, including user, role, and permission examples. `app.ts` mounts
the generated router at `/api`, so configured endpoints are available there
alongside the separately mounted `/api/auth` routes. See
`src/api-config.json` for the configured operations and their request fields.

## Security notes

- Set unique, strong `AUTH_TOKEN_SECRET` and `SESSION_SECRET` values and keep
  `.env` out of source control.
- Use HTTPS in production and configure secure OAuth state session cookies and proxy
  handling for the deployment environment.
- Protected API routes validate a signed, expiring bearer token from the
  Authorization header.
- Passwords are stored as bcrypt hashes and are omitted from API responses.
- Keep bearer tokens out of URLs and store them securely in your client.
