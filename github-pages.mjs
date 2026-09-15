import { execFileSync } from 'node:child_process';

const owner = 'xuanqisun';
const repo = 'one-g-website';
const mode = process.argv[2] || 'status';
if (!['check', 'create', 'publish', 'status'].includes(mode)) throw new Error('Unknown operation');

// Read the user's existing credential only in memory; never print or save it.
let raw;
try {
  raw = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
} catch { throw new Error('Existing GitHub credential unavailable'); }
const fields = Object.fromEntries(raw.trim().split('\n').map(line => {
  const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)];
}));
if (!fields.password) throw new Error('Existing GitHub credential unavailable');
async function request(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${fields.password}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ONE-G-Website-Publisher' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
function requireSuccess(result) {
  if (result.status < 200 || result.status >= 300) throw new Error(`GitHub ${result.status}: ${result.data.message || 'Request failed'}`);
}
const identity = await request('/user');
requireSuccess(identity);
if (identity.data.login !== owner) throw new Error('Authenticated account does not match the requested owner');
const base = `/repos/${owner}/${repo}`;
if (mode === 'check' || mode === 'create') {
  const existing = await request(base);
  console.log(JSON.stringify({ account: identity.data.login, repositoryStatus: existing.status, repository: `${owner}/${repo}` }));
  if (![200, 404].includes(existing.status)) requireSuccess(existing);
  if (mode === 'create') {
    if (existing.status !== 404) throw new Error('Repository already exists; leaving it unchanged');
    const created = await request('/user/repos', 'POST', { name: repo, private: false, auto_init: false, description: 'ONE-G 万机智能：万机商城、定制中心与企业展示。', homepage: `https://${owner}.github.io/${repo}/` });
    requireSuccess(created);
    console.log(JSON.stringify({ repository: created.data.full_name, url: created.data.html_url, visibility: created.data.visibility }));
  }
} else {
  let pages = await request(`${base}/pages`);
  if (mode === 'publish' && pages.status === 404) pages = await request(`${base}/pages`, 'POST', { source: { branch: 'gh-pages', path: '/' } });
  requireSuccess(pages);
  if (pages.data.source?.branch !== 'gh-pages' || pages.data.source?.path !== '/') throw new Error('Unexpected Pages source; leaving it unchanged');
  console.log(JSON.stringify({ url: pages.data.html_url, status: pages.data.status, source: pages.data.source }));
  if (mode === 'status') {
    const latest = await request(`${base}/pages/builds/latest`); requireSuccess(latest);
    console.log(JSON.stringify({ buildStatus: latest.data.status, commit: latest.data.commit, error: latest.data.error?.message }));
  }
}
