# Verdict Row on NEAR

**Real counterparty vetting, hired per call by agents on NEAR — paid in USDC on NEAR mainnet.**

A NEAR agent (or any NEAR account holder) sends one brief — *"Vet counterparty `0x…` before I trade with it"* — to the `verdict-row` agent on the NEAR Agent Market. The call is priced at **$2.00** over A2A + x402, the payment is escrowed by the marketplace, and a worker service runs **real production checks** on the Verdict Row fleet (Base) plus a **private risk pass** over the payer's sensitive context, then delivers a scored verdict with on-chain evidence. Escrow settles at delivery.

Built for the **NEAR HACKATHON: Build Beyond Boundaries** (Nov 2026) — tracks: **Agent Economy** (lead), **Privacy & Private AI**, **AI Security & Defense**.

## Do X → see Y

```bash
# 1. See the storefront (live):
curl https://verdict-row.market.near.ai/.well-known/agent-card.json

# 2. See the price challenge (live, unpaid probe — expect HTTP 402, $2.00,
#    network near:mainnet, payTo = marketplace treasury):
node scripts/demo-call.mjs

# 3. Run the verdict pipeline locally (real paid fleet calls on Base,
#    spend-capped; needs the fleet agent-wallet key file):
npm install
node scripts/local-test.mjs "Vet counterparty 0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F before a test trade."

# 4. Run the worker (polls the market for hires, works them, submits):
MARKET_TOKEN=<aat_ token> AGENT_KEY_FILE=~/.evm-wallet/key npm start
```

A local-test run on 2026-11-07 produced a SAFE 100/100 wallet verdict with Base
settlement tx
[0x98dbaadb…5206](https://basescan.org/tx/0x98dbaadbfb915c88643757ada65b4aa064f36a94be74ac6bdbc701accb205206).

## How it works

```
NEAR caller ──SendMessage──▶ verdict-row.market.near.ai/a2a/v1
                              │  HTTP 402: $2.00, USDC on near:mainnet,
                              │  payTo = marketplace treasury
caller signs ONE NEP-366 delegate (ft_transfer, no gas) ──▶ escrow holds
                              │
market ──hire──▶ worker (this repo): poll + webhook
                              ├─ public-data checks ─▶ Verdict Row fleet (Base, x402):
                              │    StallRow /v1/wallet-verdict ($0.02)
                              │    Token Verdict /v1/verdict ($0.02, when a token is named)
                              ├─ sensitive reasoning ─▶ NEAR AI Cloud
                              │    (TEE / confidential inference; the payer's context
                              │     never touches a public model endpoint)
                              └─ deliverable: score, signals, evidence, Base tx links
market settles escrow at delivery ──▶ treasury sweep pays the agent's account
```

The payer needs no account on our side and pays no gas. The worker never
touches NEAR funds — its market token is a seller identity; settlement and the
treasury sweep are the marketplace's job.

## Why this is not a wrapper

The thing being sold already exists and earns: **Verdict Row is a live fleet
of 44 priced x402 routes on Base** (Token Verdict, RouteVerdict, ListSmith,
StallRow, LockSmith) with real external paying buyers, health- and
settlement-verified daily. What was built in the hackathon window is the NEAR
hire rail (Agent Market agent + A2A/x402 pricing), this worker, and the
private-inference layer — the fleet itself is the pre-existing baseline
(see *Baseline disclosure*).

## The three tracks

- **Agent Economy** — an agent selling a real service to other agents, priced
  per call, settled in USDC on NEAR with escrow-until-delivery.
- **Privacy & Private AI** — the *sensitive* half of a vetting brief (why
  you're vetting, your exposure, your strategy) is reasoned over by NEAR AI
  Cloud confidential inference, architecturally separated from the public-data
  checks. The deliverable states the inference mode used and surfaces whatever
  attestation/verification data the API returns — nothing invented.
- **AI Security & Defense** — the product *is* counterparty defense for
  autonomous traders: sanctions screening, address-poisoning signals, and
  token market-structure red flags, delivered before value moves.

## Pricing

| | |
|---|---|
| Hire price | **$2.00 per verdict** (marketplace per-call plan) |
| Fleet cost per verdict | $0.02–$0.04 (production x402 calls, hard-capped at $0.10/bundle in code) |
| SLA | 1 hour (typical delivery: minutes) |

## Baseline disclosure

Per the hackathon's pre-existing-product rules: the Verdict Row fleet on Base
(services, routes, pricing, buyers) **pre-exists** this event — it has been
live and earning since October 2026 (`https://stall-row-production.up.railway.app/status.json`
shows its current checker state). **Everything in this repository** — the
`verdict-row` market agent (registered 2026-11-07), the worker service, the
privacy layer, the demo client — **was built inside the hackathon window**
and is the judged surface. The fleet is called over its public paid endpoints
exactly as any other customer would call it.

## Status / what's live

- ✅ `verdict-row` agent registered, priced ($2.00), listing **live**:
  <https://market.near.ai/a/verdict-row>
- ✅ A2A endpoint answers with the $2.00 x402 challenge (verified live).
- ✅ Worker running: assignment polling + webhook receiver (HMAC-SHA256),
  fleet leg proven end-to-end locally with Base settlement evidence.
- 🔶 Privacy layer: interface live with a local mock; real NEAR AI Cloud
  activation waits on the owner's API key (NEAR Builders $10 credit).
- 🔶 Live paid demo hire: waits on a demo payer account with ~$3 USDC.near
  (the market refuses self-hire; the demo is recorded pre-adoption).

## Layout

```
src/index.js    HTTP server (health + webhook) and the assignment poll loop
src/market.js   NEAR Agent Market REST client (assignments, start, submit)
src/fleet.js    Paid x402 calls to the Base fleet (spend-capped, proven pattern)
src/privacy.js  NEAR AI Cloud client + local mock, one interface
src/verdict.js  Brief parsing, fleet checks, deliverable composition
scripts/        demo-call.mjs (caller probe), local-test.mjs (pipeline test)
```

MIT licensed.
