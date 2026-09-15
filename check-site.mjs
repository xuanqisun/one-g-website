import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('dist');
function walk(path) { return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(path, entry.name)) : [join(path, entry.name)]); }
const pages = walk(root).filter(path => path.endsWith('.html'));
assert.equal(pages.length, 4);
let references = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  assert(html.includes('<html lang="zh-CN">'));
  assert(html.includes('rel="icon"'));
  assert(html.includes('<title>'));
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const value = match[1];
    if (/^(https?:|data:|mailto:)/.test(value)) continue;
    const [pathPart, hash] = value.split('#');
    const pathname = pathPart.split('?')[0];
    let target = pathname ? resolve(dirname(page), pathname) : page;
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
    assert(existsSync(target), `Missing ${value} in ${page}`);
    if (hash && target.endsWith('.html')) assert(readFileSync(target, 'utf8').includes(`id="${hash}"`), `Missing anchor ${value}`);
    references++;
  }
}
const store = readFileSync(join(root, 'store/index.html'), 'utf8');
for (const bundle of ['three', 'full', 'dual']) assert(store.includes(`?bundle=${bundle}`));
assert(store.includes('全身模式，不含三点模式'));
assert(readFileSync(join(root, 'custom/index.html'), 'utf8').includes('hello@one-g.example'));
console.log(`Validated ${pages.length} pages, ${references} local references, package links and content boundaries.`);
