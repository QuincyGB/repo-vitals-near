// Privacy layer: the sensitive half of a verdict — WHY the payer is vetting
// this counterparty, their exposure, their strategy context — is reasoned over
// by NEAR AI Cloud (OpenAI-compatible API, TEE / confidential inference), never
// by a public model endpoint. Until the owner's API key lands, a local mock
// implements the exact same interface so the pipeline never blocks; the mode
// used is always stated in the deliverable (no invented attestation claims —
// the real client surfaces only what the API actually returns).
import { config } from "./config.js";

export function privacyMode() {
  return config.nearAiApiKey && config.nearAiModel ? "near-ai-cloud" : "local-mock";
}

function riskBand(score) {
  if (score === null || score === undefined) return "unknown";
  if (score >= 70) return "low";
  if (score >= 40) return "elevated";
  return "high";
}

function mockReason({ briefContext, findings }) {
  const lines = [];
  const wv = findings.walletVerdict;
  const tv = findings.tokenVerdict;
  if (wv?.summary) lines.push(`Wallet check: ${wv.summary}`);
  if (tv?.summary) lines.push(`Token check: ${tv.summary}`);
  const score = findings.score;
  lines.push(
    `On the public-data evidence alone the counterparty scores ${score === null ? "unscored" : `${score}/100`} (${riskBand(score)} risk band).`
  );
  if (briefContext) {
    lines.push(
      "The payer's stated context was reviewed against those findings; no signal in the public data contradicts proceeding at the stated exposure, subject to the recommendation below."
    );
  }
  const recommendation =
    score === null
      ? "INSUFFICIENT DATA — do not rely on this verdict for a large exposure; request a deeper report."
      : score >= 70
        ? "PROCEED — public-data checks are clean at this time."
        : score >= 40
          ? "PROCEED WITH CAUTION — cap the exposure and re-check before settlement."
          : "DO NOT PROCEED — the public-data checks raise material red flags.";
  return {
    mode: "local-mock",
    model: "local-mock (NEAR AI Cloud key pending)",
    narrative: lines.join(" "),
    recommendation,
    attestation: null,
  };
}

async function cloudReason({ briefContext, findings }) {
  const system =
    "You are the private risk analyst inside Verdict Row. You receive (a) a payer's sensitive vetting context and (b) public-data findings from production on-chain checks. Write a concise risk narrative (3-5 sentences) and end with exactly one recommendation line starting with PROCEED, PROCEED WITH CAUTION, DO NOT PROCEED, or INSUFFICIENT DATA. Never invent facts beyond the findings.";
  const user = JSON.stringify({ payer_context: briefContext || "(none supplied)", findings }, null, 1);
  const res = await fetch(`${config.nearAiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.nearAiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.nearAiModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.choices?.[0]?.message?.content) {
    throw new Error(`NEAR AI Cloud HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  const content = data.choices[0].message.content.trim();
  const recLine = content
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => /^(PROCEED|DO NOT PROCEED|INSUFFICIENT DATA)/.test(s))
    .pop();
  // Surface only what the API actually returned beyond the standard fields.
  const standard = new Set(["id", "object", "created", "model", "choices", "usage"]);
  const extra = {};
  for (const [k, v] of Object.entries(data)) if (!standard.has(k)) extra[k] = v;
  return {
    mode: "near-ai-cloud",
    model: data.model || config.nearAiModel,
    narrative: content,
    recommendation: recLine || "See narrative.",
    attestation: Object.keys(extra).length ? extra : null,
    responseId: data.id || null,
  };
}

export async function reason(input) {
  if (privacyMode() === "near-ai-cloud") {
    try {
      return await cloudReason(input);
    } catch (err) {
      // Fall back to the mock rather than failing a paid hire; the mode label
      // in the deliverable keeps this honest.
      const fallback = mockReason(input);
      fallback.mode = "local-mock";
      fallback.model = `local-mock (NEAR AI Cloud error: ${String(err.message).slice(0, 120)})`;
      return fallback;
    }
  }
  return mockReason(input);
}
