# Lead Agent

A B2B lead generation web app. Pick your ideal customer profile and get a ranked list of matching companies.

## Features

- Search companies by industry, country, company size and keywords (up to 50 leads per search)
- Fit score from 0 to 100, labeled Good fit, Needs review or Poor fit, with the reasons behind it
- Mail server (MX) check on each company's domain
- Export results to CSV
- Accounts with email verification, profile editing, avatar upload and password change

## Tech stack

| Part | Tools |
| --- | --- |
| Client | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Zustand, Axios, Zod, Socket.IO client |
| Server | Node.js, Express 5, MongoDB (Mongoose), Socket.IO, Zod, JWT, bcrypt |
| Services | Wikidata (company data), Upstash Redis (online users), Cloudflare R2 (avatars), Resend (email) |

## How it works

- **Lead search:** `POST /api/leads/generate_leads` runs the selected sources in parallel and skips any that fail. The current source is Wikidata, queried with SPARQL for active companies in the chosen country and industry that have a website. New sources plug in through `server/src/sources/`.
- **Scoring:** leads are deduplicated by domain, then scored by rules: country and industry (30 points), company size (30), keywords (30) and an MX record (10). 70+ is a good fit and 40+ needs review. MX lookups only run on the top candidates to keep searches fast.
- **Auth:** JWT in an httpOnly cookie, bcrypt password hashing, hashed 6-digit email codes (10-minute expiry, 5 attempts), rate limiting (stricter on auth routes) and Helmet security headers.
- **Real-time:** Socket.IO runs on the API's port and uses the same auth cookie. After login, the client's auth store connects the socket, and the server keeps each connection in a Redis hash, `online_users` (socket ID → user ID), until it disconnects.
- **Uploads:** avatars go through Multer straight to Cloudflare R2, and the old file is deleted when replaced.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/users/register` | Create an account and email a verification code |
| POST | `/api/users/login` | Log in and set the auth cookie |
| POST | `/api/users/verify_email` | Verify the email with the 6-digit code |
| POST | `/api/users/resend_verification` | Send a new verification code |
| GET | `/api/users/me` | Get the logged-in user |
| PATCH | `/api/users/me` | Update profile and avatar |
| PATCH | `/api/users/me/password` | Change password |
| POST | `/api/users/logout` | Log out |
| POST | `/api/leads/generate_leads` | Find and rank leads |
| GET | `/health` | Server and database status |

## Getting started

You need Node.js 22.22+, a MongoDB database, and accounts for Upstash Redis, Cloudflare R2 and Resend.

1. Install dependencies from the project root:

   ```sh
   npm install
   cd server && npm install
   cd ../client && npm install
   ```

2. Create the env files:
   - `server/.env.development` from `server/.env.example`, with `CLIENT_URL=http://localhost:5173`
   - `client/.env` from `client/.env.example`

   The server loads `.env.<NODE_ENV>`, so production uses `server/.env.production`.

3. Start the server and client together from the project root:

   ```sh
   npm start
   ```

   The client runs on http://localhost:5173 and the API on http://localhost:8000.
