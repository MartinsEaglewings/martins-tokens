# Martins Tokens — Termux edition

A fresh, independent rebuild using the same broad language stack as the original AppDeploy source:
- HTML
- CSS
- TypeScript (compiled to JavaScript for the browser)
- TypeScript + Node.js/Express backend

This is a new project and does not change the original AppDeploy website.

## Important limits
- It does not connect to AppDeploy's private auth/database services.
- It starts with a new local JSON database; it does not contain existing user balances.
- This starter includes registration/login, persistent profiles, server-side spin rewards, five game screens, wallet/history, withdrawals and admin controls.
- Before public production use, move persistence to a robust database, enable HTTPS, use a persistent session store, review payout rules and test concurrency/security. Local JSON storage is for initial development only.
- Tokens are internal points, not cryptocurrency. A withdrawal request is not a promise of payment.

## Run in Termux
Install Node.js if needed, then:

```bash
pkg update
pkg install nodejs
cd ~/martins-tokens
npm install
cp .env.example .env
npm run dev
```

Open `http://127.0.0.1:5173` in your phone browser. The API runs on port 3000.

Set `SESSION_SECRET` to a long random value before exposing this app. The administrator account is determined by `ADMIN_EMAIL`; create an account using that email to see admin features.

## Deploy later
The frontend can be built with `npm run build`. The backend must run on a Node.js host with persistent storage or be migrated to a managed database. A static site host alone cannot run this backend.
