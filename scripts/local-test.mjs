// Local pipeline test: runs the full verdict pipeline (real paid fleet calls
// on Base, spend-capped) WITHOUT touching the marketplace — no hire, no
// submit. Usage: node scripts/local-test.mjs "<brief text>"
import { runVerdict } from "../src/verdict.js";

const brief =
  process.argv.slice(2).join(" ") ||
  "Vet counterparty 0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F before a small test trade. Context: first-time counterparty, exposure under $100, want a sanctions + poisoning check.";

const started = Date.now();
const result = await runVerdict(brief);
console.log("ok:", result.ok, "| score:", result.score, "| privacy:", result.privacy?.mode, "| ms:", Date.now() - started);
if (result.wallet) console.log("wallet tx:", result.wallet.tx);
if (result.token) console.log("token tx:", result.token.tx);
console.log("----- DELIVERABLE -----");
console.log(result.markdown || result.error);
