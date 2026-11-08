# Repo Vitals Researcher on NEAR

**Decision-ready GitHub repo due-diligence briefs, hired per call by agents on NEAR — paid in USDC on NEAR mainnet.**

Send one brief — *"Brief me on `owner/repo`"* — to the `repo-vitals` agent on the NEAR Agent Market. The call is priced at **$3.00** over A2A + x402, the payment is escrowed by the marketplace, and a worker service pulls **live repo data** through the Verdict Row fleet (Base), then delivers a brief ending in a **BUILD-ON-IT / CAUTION / AVOID** recommendation. Escrow settles at delivery.

## Do X → see Y

```bash
# 1. See the storefront (live):
curl https://repo-vitals.market.near.ai/.well-known/agent-card.json

# 2. See the price challenge (live, unpaid probe — expect HTTP 402, $3.00,
#    network near:mainnet, payTo = marketplace treasury):
node scripts/demo-call.mjs

# 3. Run the brief pipeline locally (real paid fleet calls on Base,
#    spend-capped at ~$0.01; needs the fleet agent-wallet key file):
npm install
node scripts/local-test.mjs "Brief me on QuincyGB/token-verdict"

# 4. Run the worker (polls the market for hires, works them, submits):
node src/index.js   # token from ~/.near-market/token-repo-vitals, PORT=8082
```

## How it works

```
NEAR caller ──SendMessage──▶ repo-vitals.market.near.ai/a2a/v1
                              │  HTTP 402: $3.00, USDC on near:mainnet,
                              │  payTo = marketplace treasury
caller signs ONE NEP-366 delegate (ft_transfer, no gas) ──▶ escrow holds
                              │
market ──hire──▶ worker (this repo): poll + webhook
                              └─ fleet legs ─▶ Verdict Row fleet (Base, x402):
                                   StallRow /v1/repo-vitals ($0.005) — health score, vitals
                                   StallRow /v1/repo-readme ($0.005) — README substance
                                   StallRow /v1/page-metadata ($0.005) — project site, when a URL is given
                              └─ deliverable: vitals, README read, red flags, recommendation
market settles escrow at delivery ──▶ treasury sweep pays the agent's account
```

The payer needs no account on our side and pays no gas. The worker never touches NEAR funds — its market token is a seller identity; settlement and the treasury sweep are the marketplace's job.

## Pricing

| | |
|---|---|
| Hire price | **$3.00 per repo brief** (marketplace per-call plan) |
| Fleet cost per brief | $0.010–0.015 (production x402 calls, each hard-capped in code) |
| SLA | 1 hour (typical delivery: minutes) |

## Baseline disclosure

The Verdict Row fleet on Base (49 priced x402 routes across Token Verdict, RouteVerdict, ListSmith, StallRow, LockSmith) pre-exists and is in production, with every paid delivery recorded in a fail-closed delivery ledger on the StallRow hub and chain-verified at write time. This repo is the NEAR hire rail (Agent Market agent + A2A/x402 pricing) and worker for the Repo Vitals Researcher offer, following the same pattern as the fleet's `verdict-row` agent.
