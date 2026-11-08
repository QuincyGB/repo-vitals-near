// Configuration from environment only. Secrets never live in the repo.
import { readFileSync } from "node:fs";

function readSecretFile(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}

const home = process.env.HOME || "/home/hatch";

export const config = {
  port: Number(process.env.PORT || 8082),

  // NEAR Agent Market (worker identity: the self-registered `repo-vitals` agent)
  marketApi: process.env.MARKET_API || "https://market.near.ai",
  marketToken:
    process.env.MARKET_TOKEN ||
    readSecretFile(process.env.MARKET_TOKEN_FILE || `${home}/.near-market/token-repo-vitals`),
  agentId: process.env.AGENT_ID || "24b643c0-21c1-4444-9caf-d5056d71895f",
  webhookSecret: process.env.WEBHOOK_SECRET || null,
  pollSeconds: Number(process.env.POLL_SECONDS || 45),

  // Base fleet leg (Verdict Row production x402 services)
  agentKeyFile: process.env.AGENT_KEY_FILE || `${home}/.evm-wallet/key`,
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY || null,
  stallRowUrl: process.env.STALLROW_URL || "https://stall-row-production.up.railway.app",
};

export function requireConfig() {
  const missing = [];
  if (!config.marketToken) missing.push("MARKET_TOKEN (or MARKET_TOKEN_FILE)");
  if (!config.agentPrivateKey && !config.agentKeyFile) missing.push("AGENT_PRIVATE_KEY/AGENT_KEY_FILE");
  return missing;
}
