// Verdict Row worker: polls the NEAR Agent Market for assignments (the
// belt-and-suspenders channel — a hire's webhook can be missed), receives
// hire.created webhooks when the owner has registered one, runs the verdict
// pipeline, and submits the deliverable. For A2A-originated hires the submit
// auto-accepts and the caller's escrow settles at delivery.
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config, requireConfig } from "./config.js";
import { market } from "./market.js";
import { runVerdict } from "./verdict.js";

const seenDeliveries = new Set();
const inFlight = new Set();

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function briefText(assignment) {
  const job = assignment.job || assignment;
  const parts = [job.title, job.description, assignment.latestMessage?.body || assignment.latestMessage?.text]
    .filter(Boolean)
    .map(String);
  return parts.join("\n");
}

async function handleAssignment(assignment) {
  const id = assignment.id || assignment.assignment_id || assignment.assignmentId;
  if (!id || inFlight.has(id)) return;
  inFlight.add(id);
  try {
    log("assignment", id, "status", assignment.status, "startedAt", assignment.startedAt ?? null);
    if (!assignment.startedAt) {
      await market.start(id).catch((e) => log("start failed (continuing):", e.message));
      await market
        .postMessage(id, "Verdict Row: work started — running the fleet checks and the private risk pass now; delivery within the hour.")
        .catch(() => {});
    }
    const result = await runVerdict(briefText(assignment));
    if (!result.ok) {
      await market.submit(id, `# Verdict Row — could not run the vet\n\n${result.error}\n`);
      log("assignment", id, "submitted needs-info (no address in brief)");
      return;
    }
    await market.submit(id, result.markdown);
    await market
      .postMessage(id, "Verdict Row: delivered. Flag anything that needs adjusting and I'll re-run the checks.")
      .catch(() => {});
    log("assignment", id, "submitted; score", result.score, "privacy", result.privacy.mode);
  } catch (err) {
    log("assignment", id, "ERROR", err.message);
  } finally {
    inFlight.delete(id);
  }
}

async function pollOnce() {
  const data = await market.listAssignments();
  const rows = data?.assignments || data || [];
  for (const a of rows) {
    const status = a.status || "in_progress";
    if (status === "in_progress" || status === "assigned" || status === "pending") {
      void handleAssignment(a);
    }
  }
}

function verifyWebhook(req, rawBody) {
  if (!config.webhookSecret) return false;
  const ts = req.headers["x-market-timestamp"];
  const sig = req.headers["x-market-signature"];
  if (!ts || !sig) return false;
  const expected = createHmac("sha256", config.webhookSecret)
    .update(`${ts}.`)
    .update(rawBody)
    .digest("hex");
  const provided = String(sig).replace(/^sha256=/, "");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

const server = createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "verdict-row-worker", agent: "verdict-row" }));
    return;
  }
  if (req.method === "POST" && req.url === "/webhook") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks);
      const event = req.headers["x-market-event"] || "unknown";
      const delivery = req.headers["x-market-delivery"] || "";
      // Always 2xx the ping, signed or not — it carries no side effects and a
      // non-2xx can auto-disable the webhook.
      if (event === "webhook.ping") {
        res.writeHead(200).end("ok");
        return;
      }
      if (!verifyWebhook(req, raw)) {
        res.writeHead(401).end("bad signature");
        return;
      }
      if (delivery && seenDeliveries.has(delivery)) {
        res.writeHead(200).end("dup");
        return;
      }
      if (delivery) seenDeliveries.add(delivery);
      res.writeHead(200).end("ok"); // ack fast; work happens via the poll loop
      if (event === "hire.created") {
        log("webhook hire.created — poll will pick it up");
        void pollOnce().catch((e) => log("poll error:", e.message));
      }
    });
    return;
  }
  res.writeHead(404).end("not found");
});

const missing = requireConfig();
if (missing.length) {
  console.error("Missing config:", missing.join(", "));
  process.exit(1);
}

server.listen(config.port, () => log(`verdict-row worker listening on :${config.port}`));
void pollOnce().catch((e) => log("initial poll error:", e.message));
setInterval(() => void pollOnce().catch((e) => log("poll error:", e.message)), config.pollSeconds * 1000);
log(`polling every ${config.pollSeconds}s`);
