// Brief pipeline: parse a hire brief for one GitHub repo, pull the live
// fleet reads on Base (paid, spend-capped), and compose the due-diligence
// brief. Legs: StallRow /v1/repo-vitals ($0.005), /v1/repo-readme ($0.005),
// and /v1/page-metadata ($0.005) for an explicit non-GitHub project URL.
// Total fleet cost per brief: $0.010–0.015.
import { repoVitals, repoReadme, pageMetadata } from "./fleet.js";

const REPO_RE = /(?:https?:\/\/)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i;
const SLUG_RE = /\b([A-Za-z][A-Za-z0-9_.-]*)\/([A-Za-z0-9_.-]+)\b/;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

export function parseBrief(text) {
  const raw = String(text || "");
  const gh = raw.match(REPO_RE);
  let repo = null;
  let extraUrl = null;
  if (gh) {
    repo = `${gh[1]}/${gh[2].replace(/\.git$/, "")}`;
    const urls = raw.match(URL_RE) || [];
    extraUrl = urls.find((u) => !u.includes("github.com")) || null;
  } else {
    const slug = raw.match(SLUG_RE);
    if (slug) repo = `${slug[1]}/${slug[2]}`;
    const urls = raw.match(URL_RE) || [];
    extraUrl = urls[0] || null;
  }
  return { repo, extraUrl, context: raw.trim().slice(0, 4000) };
}

function txLink(tx) {
  return tx ? `[${tx.slice(0, 10)}…](https://basescan.org/tx/${tx})` : "n/a";
}

function ageDays(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86400000));
}

function readmeSubstance(md) {
  if (!md) return null;
  const headings = md.split("\n").filter((l) => /^#{1,3}\s/.test(l)).map((l) => l.replace(/^#+\s*/, "")).slice(0, 12);
  const lower = md.toLowerCase();
  return {
    chars: md.length,
    headings,
    hasInstall: /install|npm i |pip install|getting started|quickstart|quick start/.test(lower),
    hasUsage: /usage|example|api reference|documentation/.test(lower),
    hasLicenseSection: /license/.test(lower),
  };
}

export async function runBrief(briefText) {
  const brief = parseBrief(briefText);
  if (!brief.repo && !brief.extraUrl) {
    return {
      ok: false,
      error:
        "No GitHub repo found in the brief. Name the repo as owner/name or a github.com URL (one repo per hire). A project-site URL can be included alongside the repo.",
      brief,
    };
  }
  let vitals = null, readme = null, meta = null;
  let txs = {};
  if (brief.repo) {
    const [vRes, rRes] = await Promise.all([repoVitals(brief.repo), repoReadme(brief.repo)]);
    vitals = vRes.status === 200 ? vRes.data : null;
    readme = rRes.status === 200 ? rRes.data : null;
    txs = { vitals: vRes.receipt?.transaction, readme: rRes.receipt?.transaction };
  }
  if (brief.extraUrl) {
    const mRes = await pageMetadata(brief.extraUrl);
    meta = mRes.status === 200 ? mRes.data : null;
    txs.meta = mRes.receipt?.transaction;
  }
  const markdown = composeMarkdown({ brief, vitals, readme, meta, txs });
  const recommendation = recommendationFor(vitals);
  return { ok: true, brief, recommendation, markdown };
}

function recommendationFor(v) {
  if (!v) return "CAUTION — vitals unavailable this run";
  const stale = (ageDays(v.pushed_at) ?? 0) > 365;
  if (v.archived || typeof v.health_score !== "number") return "CAUTION";
  if (v.health_score >= 70 && !stale) return "BUILD-ON-IT";
  if (v.health_score < 40 || stale) return "AVOID";
  return "CAUTION";
}

function composeMarkdown({ brief, vitals: v, readme, meta, txs }) {
  const lines = [];
  lines.push("# Repo Vitals Researcher — Repo Due-Diligence Brief");
  lines.push("");
  if (brief.repo) lines.push(`**Repo:** [${brief.repo}](https://github.com/${brief.repo})`);
  if (brief.extraUrl) lines.push(`**Project URL:** ${brief.extraUrl}`);
  lines.push(`**Recommendation:** ${recommendationFor(v)}`);
  lines.push("");

  lines.push("## Vital signs (live GitHub read)");
  lines.push("");
  if (v) {
    lines.push(`- Description: ${v.description ?? "n/a"}`);
    lines.push(`- Stars: ${v.stars} · Forks: ${v.forks} · Open issues: ${v.open_issues}`);
    lines.push(`- License: ${v.license ?? "none detected"}`);
    const age = ageDays(v.created_at);
    const sincePush = ageDays(v.pushed_at);
    lines.push(`- Created: ${v.created_at ?? "n/a"}${age != null ? ` (${age} days ago)` : ""} · Last push: ${v.pushed_at ?? "n/a"}${sincePush != null ? ` (${sincePush} days ago)` : ""}`);
    lines.push(`- Archived: ${v.archived}`);
    lines.push(`- Health score: **${v.health_score}/100** — ${v.verdict ?? ""}`);
    if (Array.isArray(v.health_notes) && v.health_notes.length) {
      lines.push("- Health notes:");
      for (const n of v.health_notes) lines.push(`  - ${n}`);
    }
    lines.push(`- Settlement (Base): ${txLink(txs.vitals)}`);
  } else {
    lines.push("Repo vitals unavailable this run.");
  }
  lines.push("");

  lines.push("## README substance");
  lines.push("");
  const mdText = readme?.markdown || readme?.content || readme?.readme || null;
  const sub = readmeSubstance(mdText);
  if (readme && sub) {
    lines.push(`- README: ${readme.path ?? "README"} · ${readme.size ?? sub.chars} bytes${readme.truncated ? " (truncated in source read)" : ""}`);
    lines.push(`- Install/getting-started section: ${sub.hasInstall ? "yes" : "not found"} · Usage/examples: ${sub.hasUsage ? "yes" : "not found"} · License section: ${sub.hasLicenseSection ? "yes" : "not found"}`);
    if (sub.headings.length) lines.push(`- Outline: ${sub.headings.join(" · ")}`);
    lines.push(`- Settlement (Base): ${txLink(txs.readme)}`);
  } else if (readme) {
    lines.push(`- README metadata returned without body text: ${JSON.stringify(readme).slice(0, 300)}`);
    lines.push(`- Settlement (Base): ${txLink(txs.readme)}`);
  } else {
    lines.push("README read unavailable this run.");
  }
  lines.push("");

  if (brief.extraUrl) {
    lines.push("## Project site (page metadata)");
    lines.push("");
    if (meta) {
      lines.push(`- Title: ${meta.title ?? "n/a"}`);
      lines.push(`- Description: ${meta.description ?? "n/a"}`);
      if (meta.canonical) lines.push(`- Canonical: ${meta.canonical}`);
      lines.push(`- Settlement (Base): ${txLink(txs.meta)}`);
    } else {
      lines.push("Page metadata unavailable this run.");
    }
    lines.push("");
  }

  lines.push("## Red flags & reasoning");
  lines.push("");
  const flags = [];
  if (v) {
    if (v.archived) flags.push("Repo is archived — no further maintenance is coming.");
    const sincePush = ageDays(v.pushed_at);
    if (sincePush != null && sincePush > 365) flags.push(`No push in ${sincePush} days — treat as unmaintained until proven otherwise.`);
    else if (sincePush != null && sincePush > 180) flags.push(`Last push ${sincePush} days ago — maintenance cadence is slowing.`);
    if (!v.license) flags.push("No license detected — reuse rights are unclear.");
    if (typeof v.stars === "number" && v.stars < 10) flags.push("Very small adoption footprint (<10 stars) — thin community validation.");
    if (typeof v.open_issues === "number" && v.open_issues > 100) flags.push(`${v.open_issues} open issues — check whether maintainers are keeping up before depending on it.`);
  }
  if (readme && sub && !sub.hasInstall) flags.push("README has no install/getting-started section — onboarding cost is on you.");
  if (!flags.length) flags.push("None beyond the health notes above.");
  for (const f of flags) lines.push(`- ${f}`);
  lines.push("");
  lines.push(
    `**Bottom line:** ${recommendationFor(v)} — based on the live vitals, README substance and flags above, not on the project's own claims.`
  );
  lines.push("");
  lines.push("---");
  lines.push(
    "Produced by Repo Vitals Researcher on the Verdict Row fleet (StallRow production x402 services on Base), hired per call through the NEAR Agent Market and paid in USDC on NEAR mainnet. Fleet cost of this brief: $0.010–0.015 in data calls."
  );
  return lines.join("\n");
}
