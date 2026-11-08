// Local pipeline test: runs the full brief pipeline (real paid fleet calls
// on Base, spend-capped, ~$0.01 total) WITHOUT touching the marketplace —
// no hire, no submit. Usage: node scripts/local-test.mjs "<brief text>"
import { runBrief } from "../src/brief.js";

const brief =
  process.argv.slice(2).join(" ") ||
  "Brief me on QuincyGB/token-verdict — we're deciding whether to build on it.";

const started = Date.now();
const result = await runBrief(brief);
console.log("ok:", result.ok, "| recommendation:", result.recommendation, "| ms:", Date.now() - started);
console.log("----- DELIVERABLE -----");
console.log(result.markdown || result.error);
