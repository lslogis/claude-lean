// 읽기 전용: 세션마다 고정으로 실리는 컨텍스트를 재서 표로 낸다. 아무 파일도 고치지 않는다.
// 사용: node audit.mjs [작업 폴더]   (기본: 현재 폴더)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME_DIR = os.homedir();
const HOME = path.join(HOME_DIR, '.claude');
const cwd = path.resolve(process.argv[2] || process.cwd());
const rows = []; // { kind, name, chars, tok, note, conditional }
const seen = new Set(); // 같은 파일을 두 번 세지 않는다(홈 아래 작업 폴더, 심볼릭 링크)

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const json = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const once = (p) => { const r = real(p).toLowerCase(); if (seen.has(r)) return false; seen.add(r); return true; };
// shortcut: 토크나이저 없이 추정(영문 4자≈1토큰, 한글 등 1.5자≈1토큰). 정확한 값이 필요하면 /context 로 확인.
const tokens = (s) => { const ascii = (s.match(/[\x00-\x7f]/g) || []).length; return Math.round(ascii / 4 + (s.length - ascii) / 1.5); };
const add = (kind, name, text, extra = {}) => text && rows.push({ kind, name, chars: text.length, tok: tokens(text), ...extra });

// 작업 폴더에서 루트까지. 홈은 사용자 단위로 따로 세므로 건너뛴다.
const ancestors = [];
for (let d = cwd; ; d = path.dirname(d)) {
  if (real(d).toLowerCase() !== real(HOME_DIR).toLowerCase()) ancestors.push(d);
  if (path.dirname(d) === d) break;
}

function frontmatter(md) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(md || '');
  if (!m) return {};
  const fm = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) { key = kv[1]; fm[key] = kv[2].replace(/^[>|][-+]?\s*$/, '').replace(/^["']|["']$/g, ''); }
    else if (key && /^\s+/.test(line)) fm[key] = (fm[key] + ' ' + line.trim()).trim();
  }
  return fm;
}

function skillsIn(dir, owner, extra) {
  if (!isDir(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name, 'SKILL.md');
    const md = read(file);
    if (!md || !once(file)) continue;
    const fm = frontmatter(md);
    if (String(fm['disable-model-invocation']).trim() === 'true') continue; // 사용자만 부르는 스킬은 설명이 안 실린다
    add('스킬 설명', `${owner}:${fm.name || name}`, `${fm.name || name}: ${fm.description || ''}`, extra);
  }
}

// 에이전트·명령: 폴더 안 .md 의 frontmatter 설명
function describedIn(dir, kind, owner) {
  if (!isDir(dir)) return;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const file = path.join(dir, f);
    if (!once(file)) continue;
    const fm = frontmatter(read(file));
    if (kind === '명령 설명' && String(fm['disable-model-invocation']).trim() === 'true') continue;
    add(kind, `${owner}:${fm.name || f.replace(/\.md$/, '')}`, `${fm.name || f}: ${fm.description || ''}`);
  }
}

function rulesIn(dir, owner) {
  if (!isDir(dir)) return;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const file = path.join(dir, f);
    if (once(file)) add('규칙 파일', `${owner}:${f}`, read(file));
  }
}

function claudeMd(file) {
  if (fs.existsSync(file) && once(file)) add('CLAUDE.md', file, read(file));
}

// 1. CLAUDE.md·규칙 파일: 사용자 + 작업 폴더에서 루트까지
claudeMd(path.join(HOME, 'CLAUDE.md'));
rulesIn(path.join(HOME, 'rules'), 'user');
for (const d of ancestors) {
  for (const f of ['CLAUDE.md', 'CLAUDE.local.md', path.join('.claude', 'CLAUDE.md')]) claudeMd(path.join(d, f));
  rulesIn(path.join(d, '.claude', 'rules'), `project(${d})`);
}

// 2. 메모리 색인 (폴더 이름 = 경로의 영숫자 외 문자를 '-'로)
const slug = cwd.replace(/[^A-Za-z0-9]/g, '-');
add('메모리 색인', `projects/${slug}/memory/MEMORY.md`, read(path.join(HOME, 'projects', slug, 'memory', 'MEMORY.md')));

// 3. 사용자·프로젝트 스킬·에이전트·명령
skillsIn(path.join(HOME, 'skills'), 'user');
describedIn(path.join(HOME, 'agents'), '에이전트 설명', 'user');
describedIn(path.join(HOME, 'commands'), '명령 설명', 'user');
for (const d of ancestors) {
  skillsIn(path.join(d, '.claude', 'skills'), `project(${d})`);
  describedIn(path.join(d, '.claude', 'agents'), '에이전트 설명', `project(${d})`);
  describedIn(path.join(d, '.claude', 'commands'), '명령 설명', `project(${d})`);
}

// 4. 하위 폴더의 .claude/skills: 그 폴더 파일을 다룰 때 실린다(조건부). 깊이 3, 2초 안에서만 찾는다.
const SKIP = new Set(['node_modules', '.git', '$RECYCLE.BIN', 'System Volume Information', '.venv', 'venv', '__pycache__', 'dist', 'build', 'target']);
const deadline = Date.now() + 2000;
let nestedCut = false;
(function walk(dir, depth) {
  if (depth > 3) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (Date.now() > deadline) { nestedCut = true; return; }
    if (!e.isDirectory() || SKIP.has(e.name)) continue;
    const sub = path.join(dir, e.name);
    if (e.name === '.claude') { if (depth > 0) skillsIn(path.join(sub, 'skills'), `nested(${dir})`, { conditional: true }); continue; }
    walk(sub, depth + 1);
  }
})(cwd, 0);

// 5. 켜진 플러그인(프로젝트 설정이 사용자 설정을 덮는다): 스킬·에이전트·명령 설명, 매번 글을 넣는 훅
const userSettings = json(path.join(HOME, 'settings.json')) || {};
const enabled = { ...(userSettings.enabledPlugins || {}) };
for (const d of [...ancestors].reverse()) {
  for (const f of ['settings.json', 'settings.local.json']) Object.assign(enabled, json(path.join(d, '.claude', f))?.enabledPlugins || {});
}
const installed = json(path.join(HOME, 'plugins', 'installed_plugins.json'))?.plugins || {};
const list = (v) => [].concat(v || []).filter((x) => typeof x === 'string');
const injecting = [], missing = [];
for (const [id, on] of Object.entries(enabled)) {
  if (!on) continue;
  const root = installed[id]?.[0]?.installPath;
  if (!root || !isDir(root)) { missing.push(`${id}: 설치 경로 못 찾음`); continue; }
  const manifest = json(path.join(root, '.claude-plugin', 'plugin.json')) || {};
  for (const s of ['skills', ...list(manifest.skills)]) skillsIn(path.join(root, s), id);
  for (const a of ['agents', ...list(manifest.agents)]) describedIn(path.join(root, a), '에이전트 설명', id);
  for (const c of ['commands', ...list(manifest.commands)]) describedIn(path.join(root, c), '명령 설명', id);
  const events = new Set();
  for (const h of ['hooks/hooks.json', ...list(manifest.hooks)]) for (const ev of Object.keys(json(path.join(root, h))?.hooks || {})) events.add(ev);
  if (manifest.hooks && typeof manifest.hooks === 'object' && !Array.isArray(manifest.hooks)) for (const ev of Object.keys(manifest.hooks.hooks || manifest.hooks)) events.add(ev);
  const inj = [...events].filter((e) => ['SessionStart', 'UserPromptSubmit', 'SubagentStart'].includes(e));
  if (inj.length) injecting.push(`${id}: ${inj.join(', ')}`);
}

// 출력
const fixed = rows.filter((r) => !r.conditional), cond = rows.filter((r) => r.conditional);
const total = fixed.reduce((a, r) => a + r.tok, 0);
const byKind = {};
for (const r of fixed) byKind[r.kind] = (byKind[r.kind] || 0) + r.tok;
console.log(`# 고정 컨텍스트 점검 (작업 폴더: ${cwd})\n`);
console.log(`추정 합계: 약 ${total.toLocaleString()} 토큰 (매 세션, 질문하기 전부터)\n`);
console.log('| 종류 | 추정 토큰 |\n|---|---:|');
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`| ${k} | ${v.toLocaleString()} |`);
console.log('\n## 큰 것부터 20개\n\n| 종류 | 이름 | 글자 | 추정 토큰 |\n|---|---|---:|---:|');
for (const r of [...fixed].sort((a, b) => b.tok - a.tok).slice(0, 20)) console.log(`| ${r.kind} | ${r.name} | ${r.chars.toLocaleString()} | ${r.tok.toLocaleString()} |`);
if (cond.length || nestedCut) {
  console.log(`\n## 하위 폴더 스킬 (그 폴더 파일을 다룰 때만 실림): ${cond.length}개, 약 ${cond.reduce((a, r) => a + r.tok, 0).toLocaleString()} 토큰`);
  const byDir = {};
  for (const r of cond) { const d = r.name.slice(0, r.name.lastIndexOf(':')); byDir[d] = (byDir[d] || 0) + 1; }
  for (const [d, n] of Object.entries(byDir)) console.log(`- ${d}: ${n}개`);
  if (nestedCut) console.log('- (2초 안에 다 못 찾음: 더 있을 수 있다)');
}
const dup = Object.entries(fixed.filter((r) => r.kind === '스킬 설명').reduce((m, r) => ((m[r.name.split(':').pop()] ||= []).push(r.name), m), {})).filter(([, v]) => v.length > 1);
if (dup.length) console.log('\n## 이름이 겹치는 스킬\n\n' + dup.map(([k, v]) => `- ${k}: ${v.join(', ')}`).join('\n'));
console.log('\n## 매번 글을 넣는 플러그인 훅 (양은 실행해야 알 수 있음)\n\n' + (injecting.map((s) => `- ${s}`).join('\n') || '- 없음'));
console.log(`\n## settings.json 훅 이벤트\n\n- ${Object.keys(userSettings.hooks || {}).join(', ') || '없음'}`);
if (missing.length) console.log('\n## 확인 못 한 것\n\n' + missing.map((s) => `- ${s}`).join('\n'));
console.log('\n(MCP 서버·커넥터 도구 설명과 내장 프롬프트는 못 잰다: 전체는 /context, 플러그인 하나는 `claude plugin details <이름>`.)');
