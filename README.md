# User Management API

A Node.js and TypeScript API for user authentication and session management.
It uses Express, Passport local authentication, MySQL, and server-side sessions.
The authentication routes support password login, email OTP login, and
password reset by email OTP.

## Features

- Email and password authentication using bcrypt password hashes.
- Session-based authentication with Passport and a MySQL-backed session store.
- OTP login and OTP-based password reset.
- CSRF protection for authentication and OTP request endpoints.
- A MySQL schema initializer for the user-management tables in the ERD.
- A JSON API configuration for CRUD and other operations (see
  [Dynamic API configuration](#dynamic-api-configuration)).

## Requirements

- Node.js 20 or later.
- npm.
- MySQL with a database and a user that can create tables and indexes.
- An SMTP account for OTP email delivery.

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
| `SESSION_SECRET` | Secret used to sign session cookies | Set a long, unique secret |
| `NODE_ENV` | Environment name | `development` |
| `PORT` | Server port setting shown in `.env.example` | The current app still listens on `3000`; this variable is not read yet |
| `SMTP_HOST` | SMTP server hostname | Set for OTP email |
| `SMTP_PORT` | SMTP server port | Set for OTP email |
| `SMTP_USER` | SMTP username | Set for OTP email |
| `SMTP_PASS` | SMTP password | Set for OTP email |
| `EMAIL_FROM` | Sender address for OTP email | Set for OTP email |
| `APP_URL` | Application URL used by email templates | Set for OTP email |

Use your own values in `.env`; do not commit credentials. The app currently
falls back to `dev-secret` if `SESSION_SECRET` is not set, so configure a
strong secret before deploying.

## API endpoints

All authentication endpoints are prefixed with `/api/auth`.
JSON request bodies should use `Content-Type: application/json`.
Except for logout, the POST authentication and OTP endpoints require a CSRF
token. Obtain one from `GET /api/auth/csrf-token` and send it in the
`X-CSRF-Token` header along with the cookie set by that request.
The password-login, OTP-login, and password-reset flows require a logged-out
session. Run them separately, or log out and start a fresh cookie jar before
trying another flow.

| Method | Path | Description | Authentication |
|---|---|---|---|
| `GET` | `/health` | Health check | Public |
| `GET` | `/api/auth/csrf-token` | Creates/returns a CSRF token | Public |
| `POST` | `/api/auth/login` | Sign in with email and password | Public; CSRF required |
| `POST` | `/api/auth/request-otp` | Email an OTP for login | Public; CSRF required |
| `POST` | `/api/auth/login-with-otp` | Sign in with an emailed login OTP | Public; CSRF required |
| `POST` | `/api/auth/forgot-password` | Email an OTP for password reset | Public; CSRF required |
| `POST` | `/api/auth/reset-password-with-otp` | Reset password using an OTP | Public; CSRF required |
| `GET` | `/api/auth/profile` | Return the current authenticated user | Session required |
| `POST` | `/api/auth/logout` | Destroy the current session | Session cookie; no CSRF middleware currently applied |

### Get a CSRF token

Use one cookie jar for the CSRF cookie and session cookie. These PowerShell
commands save the CSRF token to `$CsrfToken` so the following examples can be
copied without manually extracting it:

```powershell
$BaseUrl = "http://localhost:3000"
$CsrfResponse = curl.exe -sS -c cookies.txt -b cookies.txt "$BaseUrl/api/auth/csrf-token" | ConvertFrom-Json
$CsrfToken = $CsrfResponse.csrfToken
$CsrfToken
```

Health check:

```powershell
curl.exe -i "$BaseUrl/health"
```

### Password login

The response sets an authentication session cookie; `-c` saves it for later
requests.

```powershell
curl.exe -i -b cookies.txt -c cookies.txt -X POST "$BaseUrl/api/auth/login" -H "Content-Type: application/json" -H "X-CSRF-Token: $CsrfToken" --data-raw '{"email":"user@example.com","password":"YourPassword1"}'
```

Example success response:

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "Example User"
  }
}
```

The returned user object does not contain the password. Invalid credentials
return `401`.

### Get the current profile

Send the saved session cookie:

```powershell
curl.exe -i -b cookies.txt "$BaseUrl/api/auth/profile"
```

An unauthenticated request returns `401`.

### Request a login OTP

This sends an OTP to the email address belonging to an active user. The
default OTP expiry is 10 minutes.

```powershell
curl.exe -i -b cookies.txt -c cookies.txt -X POST "$BaseUrl/api/auth/request-otp" -H "Content-Type: application/json" -H "X-CSRF-Token: $CsrfToken" --data-raw '{"email":"user@example.com"}'
```

### Log in with an OTP

Use the OTP received by email and a valid CSRF token:

```powershell
curl.exe -i -b cookies.txt -c cookies.txt -X POST "$BaseUrl/api/auth/login-with-otp" -H "Content-Type: application/json" -H "X-CSRF-Token: $CsrfToken" --data-raw '{"email":"user@example.com","otp":"123456"}'
```

OTP verification rejects expired codes and allows at most three failed
attempts before deleting the code.

### Reset a forgotten password

First request a password-reset OTP:

```powershell
curl.exe -i -b cookies.txt -c cookies.txt -X POST "$BaseUrl/api/auth/forgot-password" -H "Content-Type: application/json" -H "X-CSRF-Token: $CsrfToken" --data-raw '{"email":"user@example.com"}'
```

Then submit the OTP and a new password. The password must be at least eight
characters and contain an uppercase letter, a lowercase letter, and a number:

```powershell
curl.exe -i -b cookies.txt -c cookies.txt -X POST "$BaseUrl/api/auth/reset-password-with-otp" -H "Content-Type: application/json" -H "X-CSRF-Token: $CsrfToken" --data-raw '{"email":"user@example.com","otp":"123456","password":"NewPassword1"}'
```

### Log out

```powershell
curl.exe -i -b cookies.txt -c cookies.txt -X POST "$BaseUrl/api/auth/logout"
```

The endpoint destroys the session and clears the `connect.sid` cookie.

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
- **bcryptjs** — Password hash verification and password-reset hashing.
- **csurf** — CSRF token generation and validation.
- **nodemailer** — SMTP delivery of login and password-reset OTPs.
- **dotenv** — Loads local environment variables from `.env`.
- **cors** — Cross-origin request handling.
- **cookie-parser** — Cookie parsing used by the app and CSRF middleware.
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
definitions, including user, role, and permission examples. `app.ts` creates a
router from this configuration, but its `app.use('/api', mysqlApiConfig)`
mount is currently commented out. Those configured endpoints are therefore
not available from the running app as it stands. The routes listed in this
README are the routes currently mounted by the application.

## Security notes

- Set a unique, strong `SESSION_SECRET` and keep `.env` out of source control.
- Use HTTPS in production and configure secure session cookies and proxy
  handling for the deployment environment.
- The API stores only the user ID in the session; Passport reloads the user
  from MySQL when restoring the session.
- Passwords are stored as bcrypt hashes and are omitted from API responses.
- Use CSRF tokens for the protected POST endpoints as shown above.
