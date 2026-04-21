#!/usr/bin/env node
/**
 * Autonomous deploy health check — run hourly via Claude Routine.
 *
 * For each repo in REPOS:
 *   1. Inspect the latest `deploy.yml` workflow run via GitHub API.
 *   2. If latest=failure and previous=success: re-trigger via workflow_dispatch.
 *   3. If latest=failure AND previous=failure: send alert email via Resend.
 *
 * Required env vars: GH_TOKEN, RESEND_API_KEY.
 * Exit code always 0 — this is best-effort monitoring, never blocks anything.
 */

const REPOS = [
  "chaimgelber23/jre-website",
  "chaimgelber23/seo-business",
  "chaimgelber23/hakhel-website",
  "chaimgelber23/veltari-site",
  "chaimgelber23/rabbi-silverstein",
  "chaimgelber23/lighting-plan-designer",
  "chaimgelber23/vms-checking",
  "chaimgelber23/aleph2-davening",
  "chaimgelber23/kbt-neshama-learning",
];

const ALERT_EMAIL = "chaimtgelber@gmail.com";
const FROM_EMAIL = "alerts@thejre.org";
const MAX_AGE_MIN = 120;

const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const RESEND_KEY = process.env.RESEND_API_KEY;

if (!GH_TOKEN) { console.error("GH_TOKEN/GITHUB_TOKEN env var required"); process.exit(0); }

async function ghApi(path) {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!r.ok) throw new Error(`GH ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function ghPost(path, body) {
  const r = await fetch(`https://api.github.com${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok && r.status !== 204) throw new Error(`GH POST ${path}: ${r.status} ${await r.text()}`);
}

async function sendAlert(subject, html) {
  if (!RESEND_KEY) { console.warn("  (RESEND_API_KEY missing — alert not sent)"); return; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: ALERT_EMAIL, subject, html }),
  });
  if (!r.ok) console.warn(`  (alert send failed: ${r.status} ${await r.text()})`);
  else console.log(`  → alert sent: ${subject}`);
}

async function repoDefaultBranch(repo) {
  try { return (await ghApi(`/repos/${repo}`)).default_branch; }
  catch { return "main"; }
}

async function checkRepo(repo) {
  let runs;
  try {
    const data = await ghApi(`/repos/${repo}/actions/workflows/deploy.yml/runs?per_page=2`);
    runs = data.workflow_runs || [];
  } catch (e) {
    console.log(`  ${repo}: SKIP (${e.message.slice(0, 80)})`);
    return;
  }
  if (!runs.length) { console.log(`  ${repo}: no runs yet`); return; }

  const latest = runs[0];
  const ageMin = (Date.now() - new Date(latest.created_at).getTime()) / 60000;

  if (latest.status !== "completed") { console.log(`  ${repo}: in-progress (${latest.status})`); return; }
  if (latest.conclusion === "success")  { console.log(`  ${repo}: ✅ last deploy success (${Math.round(ageMin)}m ago)`); return; }
  if (latest.conclusion === "cancelled") { console.log(`  ${repo}: cancelled by operator, ignoring`); return; }
  if (ageMin > MAX_AGE_MIN)              { console.log(`  ${repo}: last failure is ${Math.round(ageMin)}m old — not auto-retrying`); return; }

  const previous = runs[1];
  const previousAlsoFailed = previous && previous.conclusion === "failure"
    && (Date.now() - new Date(previous.created_at).getTime()) / 60000 < MAX_AGE_MIN;

  if (previousAlsoFailed) {
    console.log(`  ${repo}: ⚠ already retried and still failing — alerting`);
    await sendAlert(
      `[Deploy Alert] ${repo} failing after retry`,
      `<h2>Deploy repeatedly failing</h2>
       <p><strong>${repo}</strong> has failed its last two production deploys and auto-retry did not fix it.</p>
       <p>Latest: <a href="${latest.html_url}">${latest.display_title}</a></p>
       <p>Run the <code>/mac-mini-runner-doctor</code> skill in Claude Code to diagnose.</p>
       <hr><p style="color:#666;font-size:12px">Sent by deploy-health-check.mjs running as a Claude Routine.</p>`
    );
    return;
  }

  console.log(`  ${repo}: ❌ latest deploy failed — re-triggering via workflow_dispatch`);
  try {
    const branch = await repoDefaultBranch(repo);
    await ghPost(`/repos/${repo}/actions/workflows/deploy.yml/dispatches`, { ref: branch });
    console.log(`  ${repo}: ↻ retry dispatched on ${branch}`);
  } catch (e) {
    console.log(`  ${repo}: ERROR dispatching retry — ${e.message}`);
    await sendAlert(`[Deploy Alert] ${repo} — could not trigger retry`,
      `<p>Auto-retry dispatch failed:</p><pre>${e.message}</pre>`);
  }
}

console.log(`=== deploy health check @ ${new Date().toISOString()} ===`);
for (const repo of REPOS) {
  await checkRepo(repo).catch(e => console.log(`  ${repo}: EXCEPTION ${e.message}`));
}
console.log("=== done ===");
