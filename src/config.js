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
  port: Number(process.env.PORT || 8080),

  // NEAR Agent Market (worker identity: the self-registered `verdict-row` agent)
  marketApi: process.env.MARKET_API || "https://market.near.ai",
  marketToken:
    process.env.MARKET_TOKEN ||
    readSecretFile(process.env.MARKET_TOKEN_FILE || `${home}/.near-market/token-verdict-row`),
  agentId: process.env.AGENT_ID || "1dd87501-5b48-4bf6-b239-e648d13d2e3d",
  webhookSecret: process.env.WEBHOOK_SECRET || null,
  pollSeconds: Number(process.env.POLL_SECONDS || 45),

  // Base fleet leg (Verdict Row production x402 services)
  agentKeyFile: process.env.AGENT_KEY_FILE || `${home}/.evm-wallet/key`,
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY || null,
  fleetBundleCapUsd: Number(process.env.FLEET_BUNDLE_CAP_USD || 0.1),
  stallRowUrl: process.env.STALLROW_URL || "https://stall-row-production.up.railway.app",
  tokenVerdictUrl:
    process.env.TOKEN_VERDICT_URL || "https://token-verdict-production.up.railway.app",

  // Privacy layer (NEAR AI Cloud). Real mode requires BOTH the API key and a
  // model id; otherwise the local mock implements the same interface.
  nearAiApiKey: process.env.NEAR_AI_API_KEY || null,
  nearAiModel: process.env.NEAR_AI_MODEL || null,
  nearAiBaseUrl: process.env.NEAR_AI_BASE_URL || "https://cloud-api.near.ai/v1",
};

export function requireConfig() {
  const missing = [];
  if (!config.marketToken) missing.push("MARKET_TOKEN (or MARKET_TOKEN_FILE)");
  if (!config.agentPrivateKey && !config.agentKeyFile) missing.push("AGENT_PRIVATE_KEY/AGENT_KEY_FILE");
  return missing;
}
