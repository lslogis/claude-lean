// 읽기 전용: 세션 기록(JSONL) 하나를 읽어 토큰 사용량, 큰 도구 결과, 같은 파일 반복 읽기, 자주 쓴 명령을 표로 낸다.
// 사용: node stats.mjs [기록.jsonl | 작업 폴더]   (기본: 현재 폴더의 가장 최근 세션)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function findTranscript(arg) {
  if (arg && arg.endsWith('.jsonl') && fs.existsSync(arg)) return arg;
  const cwd = path.resolve(arg || process.cwd());
  const dir = path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
  return files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
}

const file = findTranscript(process.argv[2]);
if (!file) { console.log('세션 기록을 못 찾음. 기록 파일(.jsonl) 경로를 직접 주세요.'); process.exit(0); }

const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0 };
const seenMsg = new Set(), seenResult = new Set();
const toolUses = new Map(); // id -> { name, label }
const results = []; // { name, label, chars }
const reads = new Map(); // path -> { count, chars }
const commands = new Map(); // 앞 낱말 2개 -> count
let turns = 0, maxContext = 0;

const text = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text || '').join('') : '');
for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!line) continue;
  let j;
  try { j = JSON.parse(line); } catch { continue; }
  if (j.isSidechain) continue;
  const content = j.message?.content;
  if (j.type === 'assistant' && j.message?.usage) {
    const id = j.message.id || j.requestId;
    if (!seenMsg.has(id)) {
      seenMsg.add(id);
      const u = j.message.usage;
      usage.input += u.input_tokens || 0; usage.output += u.output_tokens || 0;
      usage.cacheRead += u.cache_read_input_tokens || 0; usage.cacheWrite += u.cache_creation_input_tokens || 0;
      usage.requests++;
      maxContext = Math.max(maxContext, (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0));
    }
  }
  if (j.type === 'user' && typeof content === 'string') turns++;
  if (!Array.isArray(content)) continue;
  for (const c of content) {
    if (c?.type === 'tool_use') {
      const inp = c.input || {};
      const label = inp.command || inp.file_path || inp.pattern || inp.url || inp.description || '';
      toolUses.set(c.id, { name: c.name, label: String(label).replace(/\s+/g, ' ').slice(0, 70), file: inp.file_path });
      if ((c.name === 'Bash' || c.name === 'PowerShell') && inp.command) {
        const key = String(inp.command).trim().replace(/^(cd|Set-Location)\s+\S+\s*(&&|;)\s*/i, '').split(/\s+/).slice(0, 2).join(' ');
        commands.set(key, (commands.get(key) || 0) + 1);
      }
    } else if (c?.type === 'tool_result' && !seenResult.has(c.tool_use_id)) {
      seenResult.add(c.tool_use_id);
      const t = text(c.content);
      const use = toolUses.get(c.tool_use_id) || { name: '?', label: '' };
      results.push({ ...use, chars: t.length });
      if (use.name === 'Read' && use.file) {
        const r = reads.get(use.file) || { count: 0, chars: 0 };
        r.count++; r.chars += t.length; reads.set(use.file, r);
      }
    }
  }
}

const n = (x) => x.toLocaleString();
console.log(`# 세션 통계\n\n기록: ${file}\n`);
console.log('| 항목 | 값 |\n|---|---:|');
console.log(`| 사용자 메시지 | ${n(turns)} |\n| API 요청 | ${n(usage.requests)} |\n| 새 입력 토큰 | ${n(usage.input)} |\n| 캐시 쓰기 토큰 | ${n(usage.cacheWrite)} |\n| 캐시 읽기 토큰 | ${n(usage.cacheRead)} |\n| 출력 토큰 | ${n(usage.output)} |\n| 가장 컸던 컨텍스트 | ${n(maxContext)} |`);
console.log('\n## 가장 큰 도구 결과 10개 (글자 수)\n\n| 도구 | 대상 | 글자 |\n|---|---|---:|');
for (const r of [...results].sort((a, b) => b.chars - a.chars).slice(0, 10)) console.log(`| ${r.name} | \`${r.label.replace(/\|/g, '\\|')}\` | ${n(r.chars)} |`);
const dup = [...reads].filter(([, r]) => r.count > 1).sort((a, b) => b[1].chars - a[1].chars).slice(0, 10);
console.log('\n## 같은 파일을 여러 번 읽음\n\n' + (dup.length ? '| 파일 | 횟수 | 글자 합 |\n|---|---:|---:|\n' + dup.map(([p, r]) => `| ${p} | ${r.count} | ${n(r.chars)} |`).join('\n') : '- 없음'));
const top = [...commands].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('\n## 자주 쓴 명령 (앞 두 낱말)\n\n' + (top.length ? top.map(([k, v]) => `- \`${k}\`: ${v}번`).join('\n') : '- 없음'));
// lean 절감 장부(~/.claude/lean/ledger.jsonl): 이 세션과 장부 전체 합계
const ledger = path.join(os.homedir(), '.claude', 'lean', 'ledger.jsonl');
const sid = path.basename(file, '.jsonl');
const sum = { s: { n: 0, before: 0, after: 0 }, all: { n: 0, before: 0, after: 0 } };
for (const f of [ledger + '.old', ledger]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    let r;
    try { r = JSON.parse(l); } catch { continue; }
    for (const k of r.s === sid ? ['s', 'all'] : ['all']) { sum[k].n++; sum[k].before += r.before; sum[k].after += r.after; }
  }
}
const pct = (x) => (x.before ? Math.round((1 - x.after / x.before) * 100) : 0);
console.log('\n## lean 이 줄인 출력\n\n| 범위 | 횟수 | 줄이기 전 글자 | 후 글자 | 줄어든 비율 |\n|---|---:|---:|---:|---:|');
for (const [label, x] of [['이 세션', sum.s], ['장부 전체', sum.all]]) console.log(`| ${label} | ${n(x.n)} | ${n(x.before)} | ${n(x.after)} | ${pct(x)}% |`);
console.log('\n(서브에이전트 내부 사용량은 빠져 있다. 토큰은 기록에 적힌 API 값 그대로다.)');
