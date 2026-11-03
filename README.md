# DAWN — Solana Memecoin Trading Desk (Web App / PWA)

DAWN is a responsive web application that can be installed on mobile and desktop as a PWA. It includes a six-agent monitoring dashboard, seven fail-closed token risk gates, wallet ownership sign-in, paper automation, decision/rejection logs, trades, event stream and an equity chart.

## Current safety boundary

- **Paper mode only.** Wallet sign-in is a message signature proving address ownership. It does not approve tokens, authorize spending, or grant transaction signing rights.
- Automatic trading is currently simulated. No real swap is signed or broadcast.
- Live trading remains disabled in the server. Do not add a seed phrase or private key to this app.
- The Raydium and PumpPortal adapters build unsigned transactions only. They are not connected to a signer.
- Missing/unknown evidence fails closed and rejects a token. A displayed pass is not a guarantee against rugs or losses.

## Run locally

Requirements: Node.js 22+.

```bash
cp .env.example .env
npm install
npm run build
npm start
```

Open `http://localhost:8787`. For local development with reload: `npm run dev`.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build -d
```

Open `http://localhost:8787`.

## Deploy as a public web app (Render)

1. Push this project to a private or public GitHub repository.
2. Sign in to Render and choose **New + → Blueprint**.
3. Connect the repository containing `render.yaml`.
4. Review the service and deploy. The blueprint keeps `TRADING_MODE=paper` and generates `COOKIE_SECRET`.
5. Render assigns an HTTPS URL. Open it on your phone or computer and connect Phantom.
6. On supported browsers, choose **安裝 DAWN App** or use the browser's **Add to Home Screen** command.

A public deployment requires your own hosting account and repository authorization. This project cannot create those accounts or publish to your domain without your explicit access. Use a persistent paid web-service plan for a continuously running scanner; free hosting may sleep or restart.

## PWA notes

- `public/manifest.webmanifest` defines the installable app.
- `public/sw.js` caches the app shell only. API responses, wallet auth and WebSocket data are never cached.
- HTTPS is required for service workers and secure wallet sessions on public hosts.

## Wallet sign-in

The browser uses Phantom's injected provider to request a one-time nonce and sign a domain-bound message. The server verifies the Ed25519 signature and sets an HTTP-only, same-site session cookie. The signature text explicitly states that it grants no token approval or transfer permission.

## Six agents

- Scout: discovers recent token/pair candidates.
- Filter: enforces seven risk gates; unknown evidence is a rejection.
- Analyst: summarizes available token and market evidence.
- Sniper: paper execution workflow.
- Guard: enforces paper-only mode and risk limits.
- Scribe: logs decisions, rejections and trades.

## Seven hard gates

1. LP burned or verifiably locked for at least 30 days.
2. Mint and freeze authorities revoked.
3. Top ten holders excluding verified LP vaults at or below 25%.
4. Creator holdings at or below 3%, with no verified rug history.
5. Initial batch allocation at or below 10%.
6. Honeypot checks pass and sell tax is zero.
7. Liquidity at least USD 40,000.

Production must verify these facts from raw on-chain state and independent sources. RugCheck or any single third-party feed is not sufficient proof.

## Before any real-money release

A production release needs an independently audited signer service (HSM/MPC or policy wallet) that parses every transaction instruction and account, allows only exact swap instruction sets and approved program IDs, bounds mints/amounts/slippage/fees/expiry, rejects arbitrary transfers and authority changes, simulates before signing, and reconciles confirmed fills. It also needs durable storage, idempotent order processing, reliable price feeds, stop-loss monitoring, alerting, incident recovery, and extensive paper testing. A -6% stop cannot guarantee a -6% realized loss during gaps, failed transactions or illiquidity.

## Integrations

- Raydium: unsigned quote/build adapter.
- PumpPortal: unsigned local transaction adapter; third-party provider requiring independent review.
- FOMO referral: informational link only. No verified official automated trading API is configured.
- `shturl.c`: not configured because the exact source/domain has not been verified.
