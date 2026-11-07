// Verdict pipeline: parse a hire brief, run the production fleet checks on
// Base (paid, spend-capped), reason over the sensitive context through the
// privacy layer, and compose the deliverable markdown.
import { walletVerdict, tokenVerdict } from "./fleet.js";
import { reason } from "./privacy.js";

const ADDRESS_RE = /0x[0-9a-fA-F]{40}/g;

export function parseBrief(text) {
  const raw = String(text || "");
  const found = [...new Set((raw.match(ADDRESS_RE) || []).map((a) => a.toLowerCase()))];
  const wantsToken = /token|coin|pair|liquidity|contract/i.test(raw);
  return {
    counterparty: found[0] || null,
    token: found[1] || (wantsToken ? found[0] : null) || null,
    wantsToken,
    context: raw.trim().slice(0, 4000),
  };
}

export function reasonText(reasons) {
  if (!Array.isArray(reasons)) return [];
  return reasons.map((r) =>
    typeof r === "string" ? r : r?.detail || r?.reason || r?.code || JSON.stringify(r)
  );
}

function summarizeWallet(r) {
  if (!r || r.status !== 200 || !r.data) return null;
  const d = r.data;
  const flags = reasonText(d.reasons);
  return {
    verdict: d.verdict,
    score: typeof d.score === "number" ? d.score : null,
    summary:
      `wallet verdict ${d.verdict} (${d.score}/100); sanctions ${d.sanctions?.status ?? "n/a"}` +
      `; wallet age ${d.wallet_age_days ?? "?"}d; poisoning ${d.poisoning?.status ?? "n/a"}` +
      (flags.length ? `; flags: ${flags.join("; ")}` : ""),
    data: d,
    tx: r.receipt?.transaction || null,
  };
}

function summarizeToken(r) {
  if (!r || r.status !== 200 || !r.data) return null;
  const d = r.data;
  const worst = Array.isArray(d.signals)
    ? [...d.signals].sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 3)
    : [];
  return {
    verdict: d.verdict,
    score: typeof d.score === "number" ? d.score : null,
    summary:
      `token verdict ${d.verdict} (${d.score}/100) for ${d.token?.symbol ?? "?"} (${d.token?.name ?? "?"})` +
      (worst.length
        ? `; weakest signals: ${worst.map((s) => `${s.name} — ${s.detail}`).join(" | ")}`
        : "") +
      (d.take ? `; take: ${d.take}` : ""),
    data: d,
    tx: r.receipt?.transaction || null,
  };
}

export async function runVerdict(briefText) {
  const brief = parseBrief(briefText);
  if (!brief.counterparty) {
    return {
      ok: false,
      error:
        "No EVM address found in the brief. Include the counterparty wallet address (and a token contract address if you want the token vetted too).",
      brief,
    };
  }

  const [wRes, tRes] = await Promise.all([
    walletVerdict(brief.counterparty),
    brief.token ? tokenVerdict(brief.token) : Promise.resolve(null),
  ]);
  const wallet = summarizeWallet(wRes);
  const token = summarizeToken(tRes);

  const scores = [wallet?.score, token?.score].filter((s) => typeof s === "number");
  const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const findings = {
    counterparty: brief.counterparty,
    tokenAddress: brief.token,
    score,
    walletVerdict: wallet ? { verdict: wallet.verdict, score: wallet.score, summary: wallet.summary } : null,
    tokenVerdict: token ? { verdict: token.verdict, score: token.score, summary: token.summary } : null,
  };

  const privacy = await reason({ briefContext: brief.context, findings });

  const md = composeMarkdown({ brief, wallet, token, score, privacy });
  return { ok: true, brief, wallet, token, score, privacy, markdown: md };
}

function txLink(tx) {
  return tx ? `[${tx.slice(0, 10)}…](https://basescan.org/tx/${tx})` : "n/a";
}

function composeMarkdown({ brief, wallet, token, score, privacy }) {
  const band = score === null ? "UNSCORABLE" : score >= 70 ? "LOW RISK" : score >= 40 ? "ELEVATED RISK" : "HIGH RISK";
  const lines = [];
  lines.push("# Verdict Row — Counterparty Verdict");
  lines.push("");
  lines.push(`**Counterparty:** \`${brief.counterparty}\` (Base)`);
  if (brief.token) lines.push(`**Token:** \`${brief.token}\``);
  lines.push(`**Headline score:** ${score === null ? "n/a" : `${score}/100`} — ${band}`);
  lines.push(`**Recommendation:** ${privacy.recommendation}`);
  lines.push("");
  lines.push("## Public-data checks (Verdict Row fleet, Base)");
  lines.push("");
  if (wallet) {
    const d = wallet.data;
    lines.push(`### Wallet verdict — ${d.verdict} (${d.score}/100)`);
    lines.push(`- Sanctions: ${d.sanctions?.status ?? "n/a"}${d.sanctions?.matched ? " (MATCH)" : ""}`);
    lines.push(`- Wallet age: ${d.wallet_age_days ?? "?"} days; outgoing txs (nonce): ${d.outgoing_tx_count_nonce ?? "?"}`);
    lines.push(`- Address poisoning: ${d.poisoning?.status ?? "n/a"}`);
    if (Array.isArray(d.reasons) && d.reasons.length) lines.push(`- Flags: ${reasonText(d.reasons).join("; ")}`);
    if (d.limits) lines.push(`- Limits: ${d.limits}`);
    lines.push(`- Settlement (Base): ${txLink(wallet.tx)}`);
  } else {
    lines.push("### Wallet verdict — unavailable this run");
  }
  lines.push("");
  if (brief.token) {
    if (token) {
      const d = token.data;
      lines.push(`### Token verdict — ${d.verdict} (${d.score}/100)`);
      lines.push(`- Token: ${d.token?.symbol ?? "?"} (${d.token?.name ?? "?"}) on ${d.token?.chain ?? "base"}`);
      if (Array.isArray(d.signals)) {
        for (const s of d.signals) lines.push(`- ${s.name}: ${s.score}/100 — ${s.detail}`);
      }
      if (d.take) lines.push(`- Take: ${d.take}`);
      lines.push(`- Settlement (Base): ${txLink(token.tx)}`);
    } else {
      lines.push("### Token verdict — unavailable this run");
    }
    lines.push("");
  }
  lines.push("## Private risk narrative");
  lines.push("");
  lines.push(privacy.narrative);
  lines.push("");
  lines.push(
    `_Inference: ${privacy.mode === "near-ai-cloud" ? `NEAR AI Cloud (confidential inference), model ${privacy.model}` : `local mock — NEAR AI Cloud activation pending (${privacy.model})`}_`
  );
  if (privacy.attestation) {
    lines.push(`_Attestation/verification data returned by the API: \`${JSON.stringify(privacy.attestation).slice(0, 400)}\`_`);
  }
  lines.push("");
  lines.push("---");
  lines.push(
    "Produced by the Verdict Row fleet (Token Verdict + StallRow, production x402 services on Base), hired per call through the NEAR Agent Market and paid in USDC on NEAR mainnet. Public-data checks only — not financial advice."
  );
  return lines.join("\n");
}
