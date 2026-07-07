#!/usr/bin/env node
// DANIL.SYS stats builder — runs inside GitHub Actions.
// Fetches live GitHub data and renders assets/stats.svg + assets/langs.svg
// in the CRT phosphor theme. No dependencies, no external services.

import { writeFileSync, mkdirSync } from "node:fs";

const login = process.env.GH_LOGIN || "TheFollenBest";
const token = process.env.GITHUB_TOKEN;

const FONT = "'Cascadia Code','JetBrains Mono','Fira Code',ui-monospace,'SF Mono',Menlo,Consolas,monospace";
const BG = "#060d07", BR = "#16351c", DIM = "#1d7a33", MID = "#2fd657", HI = "#39ff6a", XHI = "#b6ffcb";

const query = `query($login:String!){user(login:$login){
  contributionsCollection{totalCommitContributions}
  pullRequests{totalCount}
  issues{totalCount}
  repositoriesContributedTo(contributionTypes:[COMMIT,PULL_REQUEST,ISSUE,REPOSITORY]){totalCount}
  repositories(first:100,ownerAffiliations:OWNER,orderBy:{field:STARGAZERS,direction:DESC}){
    nodes{stargazerCount languages(first:8,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}
  }
}}`;

async function fetchUser() {
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: `bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { login } }),
  });
  if (!r.ok) throw new Error("GitHub API " + r.status);
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data.user;
}

function rankOf(score) {
  if (score >= 800) return ["S", 0.95];
  if (score >= 400) return ["A", 0.8];
  if (score >= 150) return ["B", 0.62];
  if (score >= 50) return ["C", 0.45];
  return ["D", 0.28];
}

const fmt = (n) => n.toLocaleString("en-US");

export function buildStatsSvg(v, syncNote) {
  const W = 470, H = 165;
  const rows = [
    ["STARS EARNED", v.stars],
    ["COMMITS (12 MO)", v.commits],
    ["PULL REQUESTS", v.prs],
    ["ISSUES OPENED", v.issues],
    ["CONTRIBUTED TO", v.contrib],
  ];
  const [letter, pct] = v.rank;
  const CIRC = 2 * Math.PI * 40;
  const dash = (CIRC * pct).toFixed(1);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub stats for ${login}">
<style>
text{font-family:${FONT}}
@keyframes stFi{to{opacity:1}}
.stFi{opacity:0;animation:stFi .3s ease-out both}
@keyframes stRing{from{stroke-dashoffset:${dash}}to{stroke-dashoffset:0}}
.stRing{stroke-dasharray:${dash} ${CIRC.toFixed(1)};animation:stRing 1.2s cubic-bezier(.2,.7,.3,1) .7s both}
@keyframes stBlink{0%,55%{opacity:1}56%,100%{opacity:0}}
.stBlink{animation:stBlink 1.1s steps(1,end) infinite}
</style>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="8" fill="${BG}" stroke="${BR}" stroke-width="1.5"/>`;
  rows.forEach((r, i) => {
    const y = 34 + i * 25;
    const leader = (r[0] + " ").padEnd(20, ".");
    s += `<text x="26" y="${y}" font-size="12.5" class="stFi" style="animation-delay:${(0.15 + i * 0.14).toFixed(2)}s"><tspan fill="${DIM}">&gt; </tspan><tspan fill="${MID}">${leader}</tspan><tspan fill="${XHI}" font-weight="bold"> ${r[1]}</tspan></text>`;
  });
  s += `<text x="26" y="${34 + 5 * 25}" font-size="12.5" fill="${HI}" class="stBlink">\u258a</text>`;
  s += `<circle cx="384" cy="72" r="40" fill="none" stroke="${BR}" stroke-width="6"/>
<circle cx="384" cy="72" r="40" fill="none" stroke="${HI}" stroke-width="6" stroke-linecap="round" transform="rotate(-90 384 72)" class="stRing"/>
<text x="384" y="82" font-size="30" font-weight="bold" fill="${HI}" text-anchor="middle" class="stFi" style="animation-delay:1.1s">${letter}</text>
<text x="384" y="132" font-size="10.5" fill="${DIM}" text-anchor="middle" letter-spacing="1.5">ARCADE RANK</text>
<text x="384" y="148" font-size="10" fill="${MID}" text-anchor="middle" opacity=".8">SCORE ${v.score}</text>
<text x="26" y="150" font-size="9.5" fill="${DIM}" opacity=".8">${syncNote}</text>
</svg>`;
  return s;
}

export function buildLangsSvg(langs, syncNote) {
  const W = 330, H = 165;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Top languages for ${login}">
<style>
text{font-family:${FONT}}
@keyframes lgFi{to{opacity:1}}
.lgFi{opacity:0;animation:lgFi .3s ease-out both}
@keyframes lgGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.lgSeg{transform-box:fill-box;transform-origin:left;animation:lgGrow .8s cubic-bezier(.2,.7,.3,1) both}
</style>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="8" fill="${BG}" stroke="${BR}" stroke-width="1.5"/>
<text x="26" y="28" font-size="11" fill="${DIM}" letter-spacing="1">TOP LOOT // LANGUAGES</text>`;
  let x = 26;
  const bw = W - 52;
  langs.forEach((l, i) => {
    const w = Math.max(2, (bw * l.pct) / 100 - 2);
    s += `<rect x="${x}" y="38" width="${w}" height="9" fill="${l.color}" class="lgSeg" style="animation-delay:${(0.2 + i * 0.12).toFixed(2)}s"/>`;
    x += (bw * l.pct) / 100;
  });
  langs.slice(0, 6).forEach((l, i) => {
    const col = i % 2, row = (i - col) / 2;
    const lx = 26 + col * 150, ly = 76 + row * 25;
    s += `<circle cx="${lx + 5}" cy="${ly - 4}" r="4.5" fill="${l.color}" class="lgFi" style="animation-delay:${(0.5 + i * 0.1).toFixed(2)}s"/>
<text x="${lx + 17}" y="${ly}" font-size="11.5" fill="${MID}" class="lgFi" style="animation-delay:${(0.5 + i * 0.1).toFixed(2)}s">${l.name} <tspan fill="${XHI}">${l.pct.toFixed(1)}%</tspan></text>`;
  });
  s += `<text x="26" y="150" font-size="9.5" fill="${DIM}" opacity=".8">${syncNote}</text></svg>`;
  return s;
}

async function main() {
  const u = await fetchUser();
  const stars = u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0);
  const commits = u.contributionsCollection.totalCommitContributions;
  const prs = u.pullRequests.totalCount;
  const issues = u.issues.totalCount;
  const contrib = u.repositoriesContributedTo.totalCount;
  const score = Math.round(stars * 5 + prs * 3 + issues + commits / 10 + contrib * 2);
  const langAgg = {};
  for (const repo of u.repositories.nodes)
    for (const e of repo.languages.edges) {
      langAgg[e.node.name] = langAgg[e.node.name] || { size: 0, color: e.node.color || "#39ff6a" };
      langAgg[e.node.name].size += e.size;
    }
  const total = Object.values(langAgg).reduce((a, l) => a + l.size, 0) || 1;
  const langs = Object.entries(langAgg)
    .map(([name, l]) => ({ name, color: l.color, pct: (100 * l.size) / total }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);
  const norm = langs.reduce((a, l) => a + l.pct, 0);
  langs.forEach((l) => (l.pct = (l.pct / norm) * 100));

  const sync = "LAST SYNC: " + new Date().toISOString().slice(0, 10);
  const vals = { stars: fmt(stars), commits: fmt(commits), prs: fmt(prs), issues: fmt(issues), contrib: fmt(contrib), score: fmt(score), rank: rankOf(score) };
  mkdirSync("assets", { recursive: true });
  writeFileSync("assets/stats.svg", buildStatsSvg(vals, sync));
  writeFileSync("assets/langs.svg", buildLangsSvg(langs, sync));
  console.log("stats.svg + langs.svg written", vals, langs);
}

if (token) main().catch((e) => { console.error(e); process.exit(1); });
else console.error("GITHUB_TOKEN missing");
