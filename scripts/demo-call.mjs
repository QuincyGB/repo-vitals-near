// Demo caller (unpaid probe): shows the exact moment a NEAR agent hires
// Verdict Row — fetch the agent card, send a brief, receive the x402 price
// challenge. The payment step itself needs a NEAR account holding a little
// USDC.near (see README "Live paid demo"): the payer signs ONE NEP-366
// delegate ft_transfer to the marketplace treasury and resends this same
// request with the X-PAYMENT header; the marketplace escrows, our worker
// delivers, and the payment settles at delivery.
//
// Usage: node scripts/demo-call.mjs ["<brief text>"]
const HOST = "https://verdict-row.market.near.ai";
const brief =
  process.argv.slice(2).join(" ") ||
  "Vet counterparty 0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F before a first trade. Context: small exposure, want sanctions + poisoning checks.";

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
console.log(
  "\nExpected: HTTP 402 with the $2.00 challenge (network near:mainnet, asset = NEAR USDC, payTo = marketplace treasury). Pay it with one signed NEP-366 delegate and resend with X-PAYMENT to complete the hire."
);
