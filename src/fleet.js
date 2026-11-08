// Fleet leg: paid calls to the production Verdict Row x402 services on Base.
// Same proven pattern as the fleet's pay-once helper (@x402/fetch exact scheme,
// per-payment spend caps enforced before signing). The signer is the fleet
// agent wallet; the key is read from env/file at runtime and never logged.
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { config } from "./config.js";

let account = null;
function signer() {
  if (account) return account;
  let key = config.agentPrivateKey;
  if (!key) key = readFileSync(config.agentKeyFile, "utf8").trim();
  if (!key.startsWith("0x")) key = `0x${key}`;
  account = privateKeyToAccount(key);
  return account;
}

function paidFetch(capUsd) {
  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer()) }],
    spendControls: { maxAmountPerPayment: `$${capUsd}` },
  });
}

function decodeReceipt(res) {
  const header = res.headers.get("PAYMENT-RESPONSE");
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function paidPost(url, body, capUsd) {
  const res = await paidFetch(capUsd)(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  return { status: res.status, data, raw: data ? null : text.slice(0, 1000), receipt: decodeReceipt(res) };
}

// Bundle prices (verified live 2026-11-07 against each service's 402):
//   StallRow /v1/wallet-verdict  $0.02   Token Verdict /v1/verdict  $0.02
export async function walletVerdict(address) {
  return paidPost(`${config.stallRowUrl}/v1/wallet-verdict`, { address }, 0.02);
}

export async function tokenVerdict(address, chain = "base") {
  return paidPost(`${config.tokenVerdictUrl}/v1/verdict`, { address, chain }, 0.02);
}

// Repo Vitals bundle (prices verified live 2026-11-07 against each 402):
//   StallRow /v1/repo-vitals $0.005   StallRow /v1/repo-readme $0.005
//   StallRow /v1/page-metadata $0.005
export async function repoVitals(repo) {
  return paidPost(`${config.stallRowUrl}/v1/repo-vitals`, { repo }, 0.005);
}

export async function repoReadme(repo) {
  return paidPost(`${config.stallRowUrl}/v1/repo-readme`, { repo }, 0.005);
}

export async function pageMetadata(url) {
  return paidPost(`${config.stallRowUrl}/v1/page-metadata`, { url }, 0.005);
}
