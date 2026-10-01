# Flowbox — Your Personal Automation Platform

A self-hosted, n8n-style automation tool built for one user (you). Visual
drag-and-drop workflow canvas, real integrations (HTTP, Slack, Email, Google
Sheets), webhook + schedule triggers, and encrypted credential storage.

```
automation-app/
├── backend/     Node.js/Express API + workflow execution engine + SQLite
├── frontend/    React + Vite visual editor
└── docker-compose.yml
```

## 1. Local setup (no Docker)

### Backend
```bash
cd backend
npm install
cp .env.example .env
```
Fill in `.env`. Generate the required secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # ENCRYPTION_KEY
node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 12))"   # ADMIN_PASSWORD_HASH
```
Then:
```bash
npm start
```
The API runs on `http://localhost:4000`.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL=http://localhost:4000
npm run dev
```
Open `http://localhost:5173`, log in with the admin username/password you hashed above.

## 2. Deploying online

The included `docker-compose.yml` builds and runs both services.

1. On your server (a small VPS works fine — 1 vCPU/1GB is enough for personal use):
   ```bash
   git clone <your-repo>
   cd automation-app
   cp backend/.env.example backend/.env   # fill in real secrets, see above
   ```
2. Put your backend's public URL in a root `.env` used by compose:
   ```bash
   echo "PUBLIC_BASE_URL=https://api.yourdomain.com" > .env
   ```
3. Set `backend/.env`'s `CORS_ORIGIN` to your frontend's URL (e.g. `https://app.yourdomain.com`).
4. Build and run:
   ```bash
   docker compose up -d --build
   ```
5. Put both services behind a reverse proxy that terminates HTTPS — e.g.
   [Caddy](https://caddyserver.com/) (automatic Let's Encrypt certs) or nginx +
   certbot. **Do not expose this app over plain HTTP on the internet** — the
   JWT and webhook secrets are only as safe as the transport they travel over.

   Minimal Caddy example:
   ```
   api.yourdomain.com {
       reverse_proxy localhost:4000
   }
   app.yourdomain.com {
       reverse_proxy localhost:80
   }
   ```

## 3. How it works

- **Triggers**: Manual (click Run), Webhook (`POST /webhooks/:workflowId` with
  a per-workflow secret), Schedule (cron expression, runs in-process via
  `node-cron`).
- **Nodes execute as a DAG**: each node's output becomes the next node's input.
  Reference earlier data in any text field with `{{$json.field}}` or
  `{{$node["nodeId"].field}}`.
- **Credentials** (API keys, Slack webhook URLs, SMTP passwords, Google
  service account JSON) are encrypted with AES-256-GCM before they touch the
  database and are never returned by the API after creation.

## 4. Security model — what's actually in place, and what isn't

**In place:**
- Passwords hashed with bcrypt; JWT auth (12h expiry) on all workflow/credential APIs.
- Credentials encrypted at rest (AES-256-GCM); DB file itself holds no plaintext secrets.
- Webhook trigger endpoints require a random per-workflow secret (not guessable), checked with constant-time comparison, separate from your login JWT.
- Rate limiting on login (brute-force slowdown) and on webhook endpoints.
- `helmet` security headers, locked-down CORS (only your configured frontend origin), input validation with `zod` on every write endpoint.
- Basic SSRF guard on the HTTP Request node (blocks calls to localhost/private IP ranges/cloud metadata addresses).
- Docker containers run as a non-root user.

**Known trade-offs — read before relying on this for anything sensitive:**
- **This is a single-user app.** There's one admin account. It is *not*
  designed for multiple people with different permission levels.
- **The "Code" node runs real JavaScript** using Node's built-in `vm` module,
  which is a soft sandbox, not a hard security boundary. This is acceptable
  only because you are the only person who can write workflows in your own
  instance. Never expose this app's editor to anyone you don't trust, and
  don't paste code from strangers into it.
- **No secrets manager integration** (e.g. Vault/AWS Secrets Manager) — the
  `ENCRYPTION_KEY` lives in your `.env` file. Keep server access locked down
  (SSH keys only, firewall, no shared root access) since anyone with file
  access to the server and the DB could decrypt credentials.
- **No 2FA** on the login. If you want this hardened further, put it behind a
  provider like Cloudflare Access / Tailscale in front of the whole app —
  that's a very effective, low-effort upgrade for a personal tool.
- **Back up `backend/data/flowbox.sqlite`** regularly — there's no built-in
  backup/replication.

## 5. Extending it

Add a new node type by:
1. Creating `backend/src/engine/nodes/yourNode.js` exporting `async function run(config, context)`.
2. Registering it in `backend/src/engine/nodes/index.js`.
3. Adding its UI metadata (label, fields) to `frontend/src/nodeDefs.js`.

No other wiring needed — the canvas, config panel, and executor all read from those two registries.
