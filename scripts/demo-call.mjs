// Demo caller (unpaid probe): fetch the agent card, send a brief, receive
// the x402 price challenge. The payment step needs a NEAR account holding a
// little USDC.near: the payer signs ONE NEP-366 delegate ft_transfer to the
// marketplace treasury and resends with the X-PAYMENT header.
//
// Usage: node scripts/demo-call.mjs ["<brief text>"]
const HOST = "https://repo-vitals.market.near.ai";
const brief =
  process.argv.slice(2).join(" ") ||
  "Brief me on QuincyGB/token-verdict — we're deciding whether to build on it.";

console.log("== 1. Agent card ==");
const card = await (await fetch(`${HOST}/.well-known/agent-card.json`)).json();
console.log(JSON.stringify({ name: card.name, interfaces: card.supportedInterfaces }, null, 1));

console.log("\n== 2. SendMessage (no payment) ==");
const res = await fetch(`${HOST}/a2a/v1`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "SendMessage",
    params: { message: { role: "user", parts: [{ type: "text", text: brief }] } },
  }),
});
console.log("HTTP", res.status);
console.log(JSON.stringify(await res.json(), null, 1));
console.log("\nExpected: HTTP 402 with the $3.00 challenge (network near:mainnet, asset = NEAR USDC, payTo = marketplace treasury).");
