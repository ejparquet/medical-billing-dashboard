# Ledgerline — Medical Billing Dashboard

A multi-client revenue cycle dashboard concept for independent medical billers and RCM firms. Single-file HTML (Tailwind via CDN), light and dark themes.

**All data is generated demo data — no real patient information.**

## Features
- KPIs: collections, outstanding A/R, days in A/R, denial rate, clean claim rate
- Claims pipeline (paid / pending / denied) and monthly collections vs. charges
- Work queue ranked by recoverable dollars: appeals due, timely-filing risk, underpayments — rows expand for timeline, fix steps and actions
- Denial trends by root cause with prevention alerts
- A/R aging by payer
- Client-by-client performance with expandable account detail
- HIPAA-minded UX: PHI masked by default, reveal requires a reason and is audit-logged, session auto-lock

## Run locally
```bash
node serve.mjs            # http://localhost:3000 (PORT=4817 node serve.mjs to change)
```
