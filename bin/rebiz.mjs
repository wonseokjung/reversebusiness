#!/usr/bin/env node
// rebiz: reversebusiness 의 실행 파일. 의존성 없음, Node 18 이상.
//
//   rebiz                       에이전트를 찾아 reversebusiness 스킬을 설치하고(REA 가 없으면 확인을 받아 함께), 예시 해부 화면을 연다
//   rebiz <주소>                그 주소의 공개 페이지를 읽어 해부 화면을 연다. REA 가 있으면 정밀 모드 (없으면 확인을 받아 설치)
//   rebiz demo                  예시 해부 화면만 연다
//   rebiz view <report.json>    리포트를 해부 화면으로 연다 (--mine <내 버전 폴더>)
//   rebiz check <report.json>   리포트 검사
//   rebiz draft <근거 JSON ...> 근거에서 초안 만들기
//   rebiz clone-check <내 버전 폴더> --source <source.json>    내 버전이 원본과 겹치는지 검사
//   rebiz fill <report.json>    모름 칸 채우기 (붙여 넣을 한 문장, 또는 --agent claude|codex 로 한 번 맡기기)
//   rebiz build <report.json>   내 버전 명세와 배운 구역 순서로 새 사이트의 출발점 만들기 (--out, --topic)
//   rebiz apply <report.json> --to <내 프로젝트 폴더>          배운 뼈대와 내 첫 화면을 견준 빈칸 목록, --agent 를 주면 새 브랜치에서 고치기까지
//   rebiz video <report.json>   해부 영상(9:16)을 파일로 뽑기 (--out, --mine)
//   rebiz --remove              이 도구가 설치한 스킬만 지우기 (REA 는 지우지 않음)
//
// 우리 스킬 설치는 폴더 복사 하나뿐이고 에이전트의 설정 파일을 건드리지 않는다.
// REA(별개의 도구, 원본 morluto/rea, MIT)는 사용자가 확인한 뒤에만 공식 npm 패키지 rea-agents 로 설치한다.
// 에이전트 설정에 REA 연결을 더하는 것은 REA 의 setup 이 한다. 확인 전에는 아무것도 내려받지 않는다. --no-rea 로 건너뛴다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTerm } from '../lib/term.mjs';
import { SKILL_NAME, planTargets, planInstall, applyInstall, planRemove, applyRemove, countFiles } from '../lib/agents.mjs';
import { REA_PACKAGE, REA_REPO, REA_NODE, REA_CLIENTS, REA_SKILL, reaState, reaInstaller, runRea, currentNode, nodeOk } from '../skill/reversebusiness/tools/rea-bridge.mjs';
import { AGENT_CLIS, DEFAULT_MINUTES, findAgentCli, agentScope, runAgent, fillPrompt, specPrompt, applyPrompt } from '../lib/delegate.mjs';
import { pickLang } from '../lib/lang.mjs';
import { banner as brandBanner } from '../lib/banner.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const SKILL_SRC = path.join(ROOT, 'skill', SKILL_NAME);
const VIEWER_SRC = path.join(ROOT, 'viewer');
const TOOLS = path.join(SKILL_SRC, 'tools');
const EXAMPLE = path.join(ROOT, 'examples', 'aicitybuilders-vibecoding');
const NPX = 'npx github:wonseokjung/reversebusiness';
const HOME = os.homedir();
const T = makeTerm(process.stdout);
const say = T.say;
const tilde = (p) => (p === HOME || p.startsWith(HOME + path.sep) ? `~${p.slice(HOME.length)}` : p);
const tool = (name) => import(pathToFileURL(path.join(TOOLS, name)).href);
const looksLikeUrl = (a) => /^https?:\/\//i.test(a) || /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(a) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i.test(a);

// 명령 표. 일의 순서대로 묶는다: 읽기 -> 검사 -> 보기 -> 만들기와 적용 -> 설치.
// planned 를 붙이면 다음 판에 들어올 자리가 된다 (안내만 하고, 다른 뜻으로 쓰지 않도록 이름을 잡아 둔다).
const COMMAND_TABLE = [
  { name: 'dissect', group: 'read', usage: 'rebiz <주소>', text: 'robots.txt 확인 뒤 공개 페이지를 읽고 해부 화면 열기 (--agent claude|codex 로 끝까지 자동 완성, --no-fill, --own, --light, --no-render)' },
  { name: 'draft', group: 'read', usage: 'rebiz draft <근거 JSON ...>', text: 'REA 근거와 정밀 모드 기록에서 초안 만들기 (옵션은 draft --help)', pass: 'from-rea.mjs' },
  { name: 'fill', group: 'read', usage: 'rebiz fill <report.json>', text: '모름 칸 채우기: 에이전트에게 붙여 넣을 한 문장을 주거나, --agent claude|codex 로 한 번 맡기기' },
  { name: 'collect', group: 'read', hidden: true, pass: 'collect.mjs' },
  { name: 'check', group: 'check', usage: 'rebiz check <report.json>', text: '리포트 검사 (--dissect-only: 해부만 했을 때)' },
  { name: 'clone-check', group: 'check', usage: 'rebiz clone-check <폴더> --source <source.json>', text: '내 버전이 원본과 겹치는지 검사', pass: 'check-clone.mjs' },
  { name: 'view', group: 'see', usage: 'rebiz view <report.json>', text: '리포트를 해부 화면으로 열기 (--mine <내 버전 폴더>, --out <파일>, --lang en)' },
  { name: 'video', group: 'see', usage: 'rebiz video <report.json>', text: '해부 영상(9:16, 1080x1920)을 파일로 뽑기 (--out <파일>, --mine <내 버전 폴더>)' },
  { name: 'demo', group: 'see', usage: 'rebiz demo', text: '예시 해부 화면만 열기' },
  { name: 'build', group: 'make', usage: 'rebiz build <report.json>', text: '내 버전 명세와 배운 구역 순서로 새 사이트의 출발점 만들기 (--out <폴더>, --topic "내 사업 주제")' },
  { name: 'apply', group: 'make', usage: 'rebiz apply <report.json> --to <내 프로젝트 폴더>', text: '배운 뼈대와 내 첫 화면을 견준 빈칸 목록 (--page <파일>, --url http://localhost:포트). --agent 를 주면 새 git 브랜치에서 고치기까지. 커밋과 배포는 하지 않음' },
  { name: 'install', group: 'setup', usage: 'rebiz', text: '깔려 있는 에이전트를 찾아 스킬 설치, REA 가 없으면 확인을 받아 함께 (Claude Code, Codex, Gemini CLI, Cursor, Antigravity)' },
  { name: 'remove', group: 'setup', usage: 'rebiz --remove', text: '이 도구가 설치한 스킬만 지우기 (REA 는 지우지 않음)', alias: ['uninstall'] },
  { name: 'help', group: 'setup', hidden: true },
  { name: 'version', group: 'setup', hidden: true },
];
const GROUPS = [['read', '읽기'], ['check', '검사'], ['see', '보기'], ['make', '만들기와 적용'], ['setup', '설치']];
const commandOf = (word) => COMMAND_TABLE.find((c) => c.name === word || (c.alias || []).includes(word)) || null;
function parse(argv) {
  const o = { cmd: '', agents: [], dirs: [], rest: [], dryRun: false, force: false, project: false, open: true, yes: false, lang: '', pages: 5, relation: 'third-party', render: 'auto', dissectOnly: false, noRea: false, light: false, noFill: false, headless: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => String(argv[++i] ?? '');
    if (!o.cmd && commandOf(a)) o.cmd = commandOf(a).name;
    else if (a === '--remove') o.cmd = 'remove';
    else if (a === '--help' || a === '-h') o.cmd = 'help';
    else if (a === '--version' || a === '-v') o.cmd = 'version';
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--force') o.force = true;
    else if (a === '--project') o.project = true;
    else if (a === '--no-open') o.open = false;
    else if (a === '--no-fill') o.noFill = true;
    else if (a === '--headless') o.headless = true;
    else if (a === '--show') o.headless = false;
    else if (a === '--agent') o.agents.push(...next().split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--dir') o.dirs.push(next());
    else if (a === '--out') o.out = next();
    else if (a === '--mine') o.mine = next();
    else if (a === '--to') o.to = next();
    else if (a === '--page') o.page = next();
    else if (a === '--url') o.url = next();
    else if (a === '--topic') o.topic = next();
    else if (a === '--timeout') o.timeout = Number(next());
    else if (a === '--lang') o.lang = next();
    else if (a === '--pages') o.pages = Number(next());
    else if (a === '--relation') o.relation = next();
    else if (a === '--own') o.relation = 'own';
    else if (a === '--no-render') o.render = 'off';
    else if (a === '--render') o.render = 'force';
    else if (a === '--dissect-only') o.dissectOnly = true;
    else if (a === '--no-rea') o.noRea = true;
    else if (a === '--light') o.light = true;
    else if (a.startsWith('-')) { o.bad = a; }
    else o.rest.push(a);
  }
  // rebiz report.json 처럼 있는 파일을 주면 그 리포트를 연다.
  if (!o.cmd && o.rest.length && /\.json$/i.test(o.rest[0]) && fs.existsSync(o.rest[0])) o.cmd = 'view';
  if (!o.cmd && o.rest.length && looksLikeUrl(o.rest[0])) o.cmd = 'dissect';
  if (!o.cmd && o.rest.length) o.bad = o.bad || o.rest[0];
  if (!o.cmd) o.cmd = 'install';
  return o;
}

let ACTIVE_LANG = '';
const activeLang = (o) => (ACTIVE_LANG = pickLang((o && o.lang) || ACTIVE_LANG));
const isEn = (o) => activeLang(o) === 'en';
const tx = (ko, en, o) => (isEn(o) ? en : ko);

function banner(extra = '', o = null) {
  say(brandBanner({ lang: isEn(o) ? 'en' : 'ko' }));
  say(`${T.gold('▍')}${T.bold('reversebusiness')} ${T.dim(PKG.version)}${extra ? `  ${T.dim(extra)}` : ''}`);
}
function promo(o = null) {
  say();
  T.rule();
  say(`${T.ivory('CONNECT AI LAB')} ${T.dim('·')} ${tx('모두를 위한 AI 교육', 'AI Education for Everyone', o)}`);
  say(`${T.dim(tx('유튜브', 'YouTube', o))}  https://www.youtube.com/@CONNECT-AI-LAB`);
  say(`${T.dim(tx('강의   ', 'Courses', o))}  https://www.aicitybuilders.com`);
}

function help(o = null) {
  banner('', o);
  if (isEn(o)) {
    say('Dissect any business from one URL: read -> 6-cell report -> clean-room my-version -> overlap check.');
    say();
    say(`  ${NPX}                 Install the skill (+ optional REA after confirm) & open example viewer`);
    say(`  ${NPX} <URL>           Dissect a URL end-to-end (opens live browser + completes with your agent)`);
    say(T.dim('  Use the command above in place of rebiz to run any subcommand without installing.'));
    say();
    const EN_GROUP = { read: 'Read', check: 'Check', see: 'View & Video', make: 'Build & Apply', setup: 'Setup' };
    const EN_CMD = {
      dissect: 'Check robots.txt, read public pages in live Chrome, open report viewer (--agent claude|codex, --headless, --no-fill)',
      draft: 'Build draft from REA evidence JSON',
      fill: 'Fill unknowns in report.json (--agent claude|codex)',
      check: 'Validate report.json (--dissect-only)',
      'clone-check': 'Check my-version for text/brand/asset overlaps against source.json',
      view: 'Render single-file HTML viewer (--mine <dir>, --lang en|ko)',
      video: 'Export 9:16 (1080x1920) dissection video (--out <file>, --mine <dir>)',
      demo: 'Open the bundled example report',
      build: 'Generate a clean-room starter site from cell 6 + section order (--out <dir>, --topic "...")',
      apply: 'Compare first screen with learned skeleton & write rebiz-apply/plan.md (--agent claude|codex)',
      install: 'Install reversebusiness skill for detected coding agents',
      remove: 'Remove skills installed by this tool (keeps REA)',
    };
    for (const [key] of GROUPS) {
      const list = COMMAND_TABLE.filter((c) => c.group === key && !c.hidden);
      say(EN_GROUP[key] || key);
      const w = Math.max(...list.map((c) => T.width(c.usage))) + 3;
      for (const c of list) say(`  ${T.pad(c.usage, w)}${T.dim(EN_CMD[c.name] || c.text)}`);
    }
    say();
    say('Options');
    say('  --yes, -y        Confirm installs/agent steps without prompting');
    say('  --dry-run        Preview changes without downloading or modifying files');
    say('  --remove         Remove only skills installed by reversebusiness');
    say('  --lang <en|ko>   Set output & viewer language (auto-detected from locale)');
    say('  --no-open        Print the HTML file path instead of opening the browser');
    say('  --headless       Run Chrome headless during page capture (default: visible window on desktop)');
    say('  --no-render      Read fetched HTML only without launching Chrome');
    say('  --light          Skip REA deep mode (--no-rea skips install offer)');
    say('  --own            Target is your own site (allows static code read)');
    say('  --agent claude|codex   Delegate fill/build/apply or one-stop dissect to an agent');
    say('  --no-fill        Stop after initial draft collection without auto-completing');
    say('  --topic <text>   Business topic for your clean-room version');
    say();
    say('Workflow');
    say('  rebiz <URL>  ->  rebiz fill  ->  rebiz build or rebiz apply  ->  rebiz view, rebiz video');
    promo(o);
    return;
  }
  say('사업 웹사이트 주소 하나를 넣으면 그 사업을 해부합니다. 읽기, 해부(6칸), 내 버전 만들기, 검사.');
  say();
  say(`  ${NPX}                 에이전트에 스킬 설치(REA 가 없으면 확인을 받아 함께) + 예시 해부 화면 열기`);
  say(`  ${NPX} <주소>          그 주소를 바로 해부 (브라우저 창을 띄워 읽고 에이전트와 끝까지 완성, --no-fill 로 초안만)`);
  say(T.dim('  아래의 rebiz 자리에 위 npx 줄을 쓰면 설치 없이 같은 명령이 됩니다.'));
  say();
  for (const [key, title] of GROUPS) {
    const list = COMMAND_TABLE.filter((c) => c.group === key && !c.hidden);
    const later = list.length > 0 && list.every((c) => c.planned);
    say(`${title}${later ? T.dim(`  (다음 판 ${list[0].planned} 에 들어옵니다)`) : ''}`);
    const w = Math.max(...list.map((c) => T.width(c.usage))) + 3;
    for (const c of list) say(`  ${c.planned ? T.dim(T.pad(c.usage, w)) : T.pad(c.usage, w)}${T.dim(c.text)}${c.planned && !later ? T.dim(`  (${c.planned} 예정)`) : ''}`);
  }
  say();
  say('옵션');
  say('  --yes, -y        묻지 않고 설치 (REA 가 없으면 REA 도)');
  say('  --dry-run        무엇이 바뀌는지만 보여 주기');
  say('  --remove         이 도구가 설치한 스킬만 지우기');
  say('  --lang <ko|en>   출력 및 해부 화면 언어 (시스템 언어 자동 감지)');
  say('  --no-open        브라우저를 열지 않고 주소만 출력');
  say('  --headless       수집용 Chrome 창을 띄우지 않고 백그라운드 실행 (데스크톱 기본: 창 표시)');
  say('  --agent <이름>   claude, codex, cursor, gemini, antigravity, agents (쉼표로 여러 개)');
  say('  --dir <폴더>     스킬 폴더를 직접 지정      --project   지금 폴더의 .claude/skills');
  say('  --force          같은 이름의 다른 폴더가 있으면 백업하고 설치');
  say('  --out <폴더>     <주소> 를 읽은 결과를 둘 곳    --pages <1~5>   읽을 페이지 수');
  say('  --own            <주소> 가 내 것일 때 (리포트에 내 것으로 적음)');
  say('  --no-render      글이 얇아도 브라우저로 그려 읽지 않기   --render   항상 그려 읽기');
  say('  --light          REA 가 있어도 가벼운 모드로 읽기 (펼치기와 코드 읽기 없음)');
  say('  --no-rea         REA 설치 제안을 건너뛰기 (REA 가 없으면 가벼운 모드)');
  say('  --dissect-only   check 에서 내 버전 칸이 비어 있어도 통과 (해부만 했을 때)');
  say('  --topic <말>     build 에서 내 사업의 주제       --to <폴더>   apply 할 내 프로젝트 폴더');
  say('  --page <파일>    apply 에서 내 첫 화면 파일      --url <주소>  apply 에서 내 개발 서버 주소 (내 컴퓨터 주소만)');
  say('  --agent claude|codex   dissect, fill, build, apply 에서 판단이 필요한 단계를 내 에이전트에 한 번 맡기기 (확인 뒤 실행, --timeout <분>)');
  say('  --no-fill              rebiz <주소> 에서 에이전트 자동 완성 제안을 건너뛰고 초안만 열기');
  say();
  say('해부 다음에 할 일');
  say('  rebiz <주소>  ->  rebiz fill  ->  rebiz build 또는 rebiz apply  ->  rebiz view, rebiz video');
  promo(o);
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;
    rl.question(question, (a) => { answered = true; rl.close(); resolve(a.trim().toLowerCase()); });
    // 답 없이 입력이 닫히면 설치하지 않는 쪽으로 본다.
    rl.on('close', () => { if (!answered) { process.stdout.write('\n'); resolve('n'); } });
  });
}

// 해부 화면을 만들고 연다. 열 수 없으면 주소만 알려 준다.
async function showView(reportFile, { mine, out, lang, open }) {
  const { buildView, openFile } = await tool('build-view.mjs');
  const effectiveLang = pickLang(lang);
  const file = buildView(reportFile, out, { mine, lang: effectiveLang });
  const url = pathToFileURL(file).href;
  say(`${T.gold(effectiveLang === 'en' ? 'Report view' : '해부 화면')}  ${url}`);
  if (open) { openFile(file); say(T.dim(effectiveLang === 'en' ? 'Opened in your browser. If it did not open, paste the URL above.' : '브라우저에서 열었습니다. 열리지 않으면 위 주소를 브라우저에 붙여 넣으세요.')); }
  return file;
}
async function showDemo(o) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebiz-'));
  const out = path.join(dir, 'reversebusiness-demo.html');
  return showView(path.join(EXAMPLE, 'report.json'), { mine: path.join(EXAMPLE, 'my-version'), out, lang: o.lang, open: o.open });
}

const ACTION_LABEL = { install: '새로 설치', update: '갱신', replace: '백업 후 설치', skip: '건너뜀', blocked: '건드리지 않음' };
const ACTION_LABEL_EN = { install: 'install', update: 'update', replace: 'backup & install', skip: 'skip', blocked: 'untouched' };
// 물어볼 사람이 있는 터미널인지. REBIZ_TEST_TTY 는 시험에서 대화형 확인을 흉내 낼 때만 쓴다.
const interactive = () => process.env.REBIZ_TEST_TTY === '1' || !!(process.stdin.isTTY && process.stdout.isTTY);

// ---------- REA 함께 설치하기 (확인을 받은 뒤에만) ----------
// REA 가 낸 JSON 을 읽는다 (앞뒤에 다른 글이 섞여도 첫 중괄호부터 읽는다).
function parseJson(text) {
  const i = String(text).indexOf('{');
  if (i < 0) return null;
  try { return JSON.parse(String(text).slice(i)); } catch { return null; }
}
const REA_HOW = `npx -y ${REA_PACKAGE}@latest setup`;
const reaCmd = (args) => `npx -y ${REA_PACKAGE}@latest ${args.join(' ')}`;
// REA 를 함께 설치할지 정한다. 여기서는 아무것도 내려받지 않고, 아무것도 부르지 않고, 아무것도 바꾸지 않는다.
// forDissect: rebiz <주소> 에서 부를 때. 연결할 에이전트가 없어도 이번 해부에는 쓸 수 있다.
async function planRea(o, targets, { forDissect = false } = {}) {
  const en = isEn(o);
  if (o.noRea) return { state: 'skip', line: en ? 'Skipping REA install offer (--no-rea). Using built-in light mode.' : 'REA 설치 제안을 건너뜁니다 (--no-rea). REA 가 없으면 가벼운 모드로 동작합니다.' };
  const st = await reaState();
  if (st.state === 'present') {
    const usable = st.runner && (st.runner.how !== 'npx' || nodeOk(currentNode()));
    return { state: 'present', line: en
      ? (usable ? `REA ${st.version ? `(${st.version}) ` : ''}detected — leaving as-is; precise mode enabled.` : `REA skill detected (node ${currentNode()} cannot run REA, which needs Node 22.19+ / 24.11+ / 26+); falling back to light mode.`)
      : (usable ? `REA 있음${st.version ? ` (${st.version})` : ''}. 다시 설치하지 않습니다. 주소를 넣으면 정밀 모드로 읽습니다.` : `REA 있음 (스킬 확인). 다시 설치하지 않습니다. 다만 지금 Node(${currentNode()})로는 REA 를 부를 수 없어 주소 해부는 가벼운 모드로 동작합니다. REA 는 ${REA_NODE}이 필요합니다.`) };
  }
  if (st.state === 'node-too-old') return { state: 'node-too-old', line: en
    ? `REA skipped (requires Node 22.19+ / 24.11+ / 26+; current ${currentNode()}). Continuing in light mode.`
    : `REA 는 건너뜁니다. REA 는 ${REA_NODE}이 필요한데 지금 Node 는 ${currentNode()} 입니다. Node 를 올린 뒤 ${REA_HOW} 을 실행하면 정밀 모드가 켜집니다. 그때까지는 가벼운 모드로 동작합니다.` };
  const installer = reaInstaller();
  const keys = [...new Set(targets.flatMap((t) => t.keys || []))];
  const clients = [...new Set(keys.map((k) => REA_CLIENTS[k]).filter(Boolean))];
  if (!clients.length && !forDissect) return { state: 'no-client', line: en ? `REA skipped (no agent selected). Install later: ${REA_HOW}` : `REA 는 건너뜁니다. REA 를 연결할 에이전트를 고르지 않았습니다. 나중에: ${REA_HOW}` };
  const args = clients.length ? ['setup', ...clients.flatMap((c) => ['--client', c])] : null;
  return { state: 'install', installer, args, clients };
}
const REA_ACT = { configure_client: 'REA 연결 추가', install_skill: 'REA 스킬 설치' };
const REA_ACT_EN = { configure_client: 'configure REA', install_skill: 'install REA skill' };
// 확인을 받기 전에 보여 주는 것: 공식 패키지 이름, 실행할 명령, 바뀔 위치.
function showReaPlan(rp, o = null) {
  const en = isEn(o);
  say(T.dim(en ? `REA (upstream ${REA_REPO.replace('https://', '')}, MIT, separate tool)` : `REA (원본 ${REA_REPO.replace('https://', '')}, MIT, 별개의 도구)`));
  if (rp.state !== 'install') { say(`  ${rp.state === 'present' ? T.ivory(rp.line) : T.dim(rp.line)}`); return; }
  say(`  ${T.ivory(en ? 'REA is not installed. Confirm to install official REA for precise mode (surface, flow, code).' : 'REA 가 없습니다. 확인하면 공식 REA 를 설치해 정밀 모드(겉, 흐름, 속)로 읽습니다.')}`);
  say(`  ${T.pad(en ? 'Package' : '패키지', 14)}${REA_PACKAGE}  ${T.dim(en ? '(official npm package only)' : '(npm 의 공식 패키지. 이 이름만 씁니다)')}`);
  if (rp.args) {
    say(`  ${T.pad(en ? 'Command' : '실행할 명령', 14)}${reaCmd(rp.args)}`);
    say(`  ${T.pad(en ? 'Changes' : '바뀔 곳', 14)}${rp.clients.join(', ')} ${en ? 'config' : '의 설정 파일'}  ${T.gold(en ? 'configure REA' : 'REA 연결 추가')}`);
    say(`  ${T.pad('', 14)}${tilde(path.join(HOME, '.agents', 'skills', REA_SKILL))} ${en ? 'etc.' : '등 스킬 폴더'}  ${T.gold(en ? 'install REA skill' : 'REA 스킬 설치')}`);
    say(T.dim(en ? '  REA setup updates configs after creating backups and prints its dry-run plan first.' : '  설정 파일을 바꾸는 것은 REA 의 setup 이며, 바꾸기 전에 REA 가 백업을 남깁니다. 확인한 뒤 REA 가 낸 정확한 계획을 먼저 보여 줍니다.'));
  } else {
    say(`  ${T.pad(en ? 'Command' : '실행할 명령', 14)}${reaCmd(['inspect-web-page', '…'])}  ${T.dim(en ? '(this run only)' : '(이번 해부에만)')}`);
    say(`  ${T.pad(en ? 'Changes' : '바뀔 곳', 14)}${en ? 'npm cache only (no agent config changes).' : `npm 의 내려받기 보관함만. ${T.dim('REA 를 연결할 에이전트가 없어 설정 파일은 바꾸지 않습니다')}`}`);
  }
  say(T.dim(en ? '  Nothing downloads before confirmation. Skip with --no-rea.' : '  확인 전에는 아무것도 내려받지 않습니다. 건너뛰려면 --no-rea'));
}
// REA 설치를 확인받는다. 돌려주는 것: yes / no / need-yes / dry-run
async function confirmRea(o) {
  if (o.dryRun) return 'dry-run';
  if (o.yes) return 'yes';
  if (!interactive()) return 'need-yes';
  return isYes(await ask(`${T.gold('?')} ${isEn(o) ? 'Install REA too? [Y/n] ' : 'REA 도 설치할까요? [Y/n] '}`)) ? 'yes' : 'no';
}
// 확인을 받은 뒤에만 부른다: REA 가 스스로 낸 계획(dry-run)을 먼저 받아 보여 주고, 이어서 설치한다.
// 돌려주는 것: { ok, runner } (ok 가 false 면 가벼운 모드로 계속한다)
async function applyRea(rp, o = null) {
  const en = isEn(o);
  if (!rp.args) { say(T.dim(en ? `  Running official ${REA_PACKAGE} for this run.` : `  이번 해부에 공식 패키지 ${REA_PACKAGE} 를 npx 로 씁니다.`)); return { ok: true, runner: rp.installer }; }
  const later = en ? `Later: ${REA_HOW}` : `나중에: ${REA_HOW}`;
  say(T.dim(en ? `Fetching REA install plan (npm ${REA_PACKAGE})...` : `REA 의 설치 계획을 받아 오는 중입니다 (npm 의 공식 패키지 ${REA_PACKAGE})`));
  const p = await runRea(rp.installer, [...rp.args, '--dry-run', '--json'], { timeoutMs: 300000 });
  const pj = p.code === 0 ? parseJson(p.stdout) : null;
  if (!pj || pj.status !== 'planned' || !Array.isArray(pj.plannedActions)) { say(`  ${T.gold(en ? 'Skipping REA' : 'REA 는 건너뜁니다')}  ${en ? 'Could not retrieve REA plan' : 'REA 의 설치 계획을 받지 못했습니다'}${p.timedOut ? (en ? ' (timeout)' : ' (시간 초과)') : ''}. ${en ? 'Continuing in light mode.' : '가벼운 모드로 계속합니다.'} ${later}`); return { ok: false }; }
  if (pj.plannedActions.length) {
    const w = Math.max(...pj.plannedActions.map((a) => T.width(String(a.label || a.kind)))) + 2;
    const actMap = en ? REA_ACT_EN : REA_ACT;
    for (const a of pj.plannedActions) say(`  ${T.pad(String(a.label || a.kind), w)}${tilde(String(a.target || ''))}  ${T.gold(actMap[a.kind] || String(a.kind))}`);
  }
  say(T.dim(en ? `Installing REA (${REA_PACKAGE} setup)...` : `REA 를 설치하는 중입니다 (${REA_PACKAGE} setup)`));
  const r = await runRea(rp.installer, [...rp.args, '--yes', '--json'], { timeoutMs: 600000 });
  const j = parseJson(r.stdout);
  if (r.code !== 0 || !j) { say(`  ${T.gold(en ? 'REA install failed' : 'REA 설치 실패')}  ${r.timedOut ? (en ? 'timeout' : '시간 초과') : (en ? 'REA setup did not finish' : 'REA setup 이 끝나지 않았습니다')}. ${en ? 'Continuing in light mode.' : '가벼운 모드로 계속합니다.'} ${later}`); return { ok: false }; }
  const applied = (Array.isArray(j.appliedActions) ? j.appliedActions : []).map((a) => (typeof a === 'string' ? a : String((a && (a.kind || a.id)) || '')));
  const nc = applied.filter((a) => /^configure/.test(a)).length;
  const ns = applied.some((a) => /^install(ed)?_skill/.test(a));
  say(`  ${T.gold(en ? 'REA installed' : 'REA 설치')}  ${en ? `${nc} agent config(s)${ns ? ', skill installed' : ''}` : `에이전트 연결 ${nc}곳${ns ? ', REA 스킬 설치' : ''}`}${j.status ? T.dim(`  (${j.status})`) : ''}`);
  return { ok: true, runner: rp.installer };
}

async function install(o) {
  activeLang(o);
  const en = isEn(o);
  banner(o.dryRun ? tx('dry-run: 아무것도 바꾸지 않습니다', 'dry-run: no changes will be made', o) : 'CONNECT AI LAB', o);
  say(tx('사업 웹사이트 주소 하나를 넣으면 그 사업을 해부합니다.', 'Put in one business website URL and dissect its model, flow, and structure.', o));
  say();
  const { targets, unknown, known } = planTargets({ agents: o.agents, dirs: o.dirs, project: o.project });
  if (unknown.length) { say(en ? `Unknown agent(s): ${unknown.join(', ')} (choose from: ${known.join(', ')})` : `모르는 에이전트: ${unknown.join(', ')}  (${known.join(', ')} 중에서)`); process.exitCode = 2; return; }
  let installed = 0;
  let reaInstalled = false;
  if (!targets.length) {
    say(en ? 'No supported coding agent folder found on this machine (Claude Code, Codex, Gemini CLI, Cursor, Antigravity).' : '이 컴퓨터에서 에이전트 폴더를 찾지 못했습니다 (Claude Code, Codex, Gemini CLI, Cursor, Antigravity).');
    say(en ? `Specify directly:  ${NPX} --agent claude   or   --dir <skills-folder>` : `직접 고르기:  ${NPX} --agent claude   또는   --dir <스킬 폴더>`);
  } else {
    const plan = planInstall(targets, { force: o.force, version: PKG.version });
    const rp = await planRea(o, targets);
    const files = countFiles(SKILL_SRC) + countFiles(VIEWER_SRC);
    const w = Math.max(...plan.map((p) => T.width(p.label))) + 2;
    const w2 = Math.max(...plan.map((p) => T.width(tilde(p.dest)))) + 2;
    say(T.dim(en ? 'Detected agents and planned changes' : '찾은 에이전트와 바뀔 것'));
    const labels = en ? ACTION_LABEL_EN : ACTION_LABEL;
    for (const p of plan) {
      const label = p.action === 'update' ? `${labels.update} (${p.from} → ${p.to})` : labels[p.action];
      say(`  ${T.ivory(T.pad(p.label, w))}${T.pad(tilde(p.dest), w2)}${p.action === 'skip' || p.action === 'blocked' ? T.dim(label) : T.gold(label)}${p.why ? T.dim(`  ${p.why}`) : ''}`);
    }
    const todo = plan.filter((p) => !['skip', 'blocked'].includes(p.action));
    say(T.dim(en ? `  Copies ${files} skill files into those folders without modifying agent config files.` : `  위 폴더에 reversebusiness 스킬 파일 ${files}개를 복사합니다. 이 복사는 에이전트의 설정 파일을 건드리지 않습니다.`));
    say();
    showReaPlan(rp, o);
    say();
    const withRea = rp.state === 'install';
    if (!todo.length && !withRea) { say(en ? 'Everything is already up to date.' : '새로 설치할 곳이 없습니다.'); }
    else if (o.dryRun) { say(en ? `Run without --dry-run to install:  ${NPX} --yes${withRea ? T.dim('   (skip REA: --no-rea)') : ''}` : `실제로 설치하려면 --dry-run 을 빼고 실행하세요:  ${NPX} --yes${withRea ? T.dim('   (REA 없이: --no-rea)') : ''}`); }
    else {
      let go = !todo.length || o.yes;
      if (!go && interactive()) {
        go = isYes(await ask(`${T.gold('?')} ${en ? 'Install the reversebusiness skill? [Y/n] ' : 'reversebusiness 스킬을 설치할까요? [Y/n] '}`));
        if (!go) say(en ? 'Skill installation skipped.' : '스킬은 설치하지 않았습니다.');
      } else if (!go) {
        say(en ? `Confirmation needed in non-interactive terminal. Run with --yes:  ${NPX} --yes${withRea ? T.dim('   (skip REA: --no-rea)') : ''}` : `확인이 필요합니다. 설치하려면 --yes 를 붙여 다시 실행하세요:  ${NPX} --yes${withRea ? T.dim('   (REA 없이: --no-rea)') : ''}`);
      }
      if (go && todo.length) {
        const done = applyInstall(plan, { skillSrc: SKILL_SRC, viewerSrc: VIEWER_SRC, version: PKG.version, pkgName: PKG.name });
        for (const d of done) {
          if (d.backup) say(`  ${T.dim(en ? 'Backup' : '백업')}  ${tilde(d.backup)}`);
          if (d.files) { say(`  ${T.gold(en ? 'Installed' : '설치')}  ${T.pad(d.label, w)}${tilde(d.dest)}  ${T.dim(en ? `${d.files} files` : `파일 ${d.files}개`)}`); installed += 1; }
        }
      }
      // REA 는 따로 묻는다. 물어볼 사람이 없는 터미널에서 --yes 가 없으면 설치하지 않는다 (위에서 바뀔 것만 보여 주었다).
      if (withRea && (go || interactive())) {
        const c = await confirmRea(o);
        if (c === 'yes') reaInstalled = (await applyRea(rp, o)).ok;
        else if (c === 'no') say(en ? `Skipped REA install; continuing in light mode. Install later: ${REA_HOW}` : `REA 는 설치하지 않았습니다. 가벼운 모드로 동작합니다. 나중에 정밀 모드로: ${REA_HOW}`);
      }
    }
  }
  if (o.dryRun) return;
  say();
  await showDemo(o);
  say();
  if (installed || reaInstalled) {
    say(`${T.bold(en ? 'Start a fresh agent session and ask' : '이제 에이전트를 새로 시작하고 이렇게 말하세요')}`);
    say(`  ${T.hi(en ? 'Dissect https://example.com with reversebusiness' : '"reversebusiness 로 <궁금한 사업의 주소> 를 해부해 줘"')}`);
  } else {
    say(`${T.bold(en ? 'Run directly from your terminal' : '에이전트 없이 바로 해부하기')}`);
  }
  say(`  ${T.dim(en ? 'From terminal:' : '터미널에서 바로:')}  ${NPX} ${en ? '<URL>' : '<주소>'}`);
  say(`  ${T.dim(en ? 'Uninstall:    ' : '지우기:        ')}  ${NPX} --remove`);
  say(T.dim(en ? 'Note: reads public pages only (respects robots.txt) and never copies target brand, copy, or code.' : '지켜야 할 선: 로그인, 결제, 접근 제한을 넘지 않고, 코드, 문구, 이미지, 브랜드를 가져오지 않습니다.'));
  promo(o);
}

function remove(o) {
  activeLang(o);
  const en = isEn(o);
  banner(o.dryRun ? (en ? 'Uninstall dry-run' : '지우기 dry-run') : (en ? 'Uninstall' : '지우기'), o);
  say();
  const plan = planRemove({ agents: o.agents, dirs: o.dirs, project: o.project });
  if (!plan.length) { say(en ? 'Nothing to remove.' : '지울 것이 없습니다.'); return; }
  for (const p of plan) {
    if (p.action === 'keep') say(`  ${T.dim(en ? 'Keep' : '남겨 둠')}  ${tilde(p.dest)}  ${T.dim(en ? 'not installed by this tool' : '이 도구가 설치한 폴더가 아닙니다')}`);
    else say(`  ${T.gold(o.dryRun ? (en ? 'Will remove' : '지울 예정') : (en ? 'Removed' : '지움'))}  ${tilde(p.dest)}`);
  }
  if (!o.dryRun) applyRemove(plan);
  say();
  say(T.dim(en ? 'Any backup folders (reversebusiness.backup-...) were kept.' : '백업 폴더(reversebusiness.backup-...)가 있다면 그대로 남아 있습니다.'));
  say(T.dim(en ? `REA was left untouched. To uninstall REA too: npx -y ${REA_PACKAGE}@latest uninstall` : `REA 는 지우지 않았습니다 (별개의 도구). REA 까지 지우려면: npx -y ${REA_PACKAGE}@latest uninstall`));
}

async function view(o) {
  activeLang(o);
  const en = isEn(o);
  const file = o.rest[0];
  if (!file) { say(en ? 'Usage: rebiz view <report.json> [--mine <dir>] [--out <file>] [--no-open]' : '사용: rebiz view <report.json> [--mine <내 버전 폴더>] [--out <파일>] [--no-open]'); process.exitCode = 2; return; }
  try { await showView(file, { mine: o.mine, out: o.out && path.resolve(o.out), lang: o.lang, open: o.open }); } catch (e) { say(en ? `Failed to build view: ${e.message}` : `만들지 못했습니다: ${e.message}`); process.exitCode = 1; return; }
  nextLines(`rebiz video ${shown(file)}${o.mine ? ` --mine ${shown(o.mine)}` : ''}`);
}

async function check(o) {
  activeLang(o);
  const en = isEn(o);
  const file = o.rest[0];
  if (!file) { say(en ? 'Usage: rebiz check <report.json> [--dissect-only]' : '사용: rebiz check <report.json> [--dissect-only]'); process.exitCode = 2; return; }
  const { checkReport } = await tool('check-report.mjs');
  let r;
  try { r = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { say(en ? `Cannot read file: ${e.message}` : `읽을 수 없습니다: ${e.message}`); process.exitCode = 2; return; }
  const { errors, warnings, counts, myVersion } = checkReport(r, { dissectOnly: o.dissectOnly });
  say(en ? `observed ${counts.observed} · inferred ${counts.inferred} · unknown ${counts.unknown}` : `관찰 ${counts.observed} · 추정 ${counts.inferred} · 모름 ${counts.unknown}`);
  if (o.dissectOnly) say(en ? `my_version  ${myVersion === 'empty' ? 'empty (dissect-only)' : 'filled (checked)'}` : `내 버전 칸  ${myVersion === 'empty' ? '아직 안 씀 (해부만 검사)' : '쓰여 있어서 함께 검사'}`);
  for (const w of warnings) say(`${en ? 'Warn ' : '경고  '}${w}`);
  for (const e of errors) say(`${en ? 'Error ' : '오류  '}${e}`);
  say(errors.length
    ? (en ? `${errors.length} error(s). Fix and re-run check.` : `오류 ${errors.length}개. 고친 뒤 다시 검사해 주세요.`)
    : (en ? `Passed (${warnings.length} warning(s))${o.dissectOnly && myVersion === 'empty' ? ' · dissect-only' : ''}` : `통과 (경고 ${warnings.length}개)${o.dissectOnly && myVersion === 'empty' ? ' · 해부만' : ''}`));
  if (errors.length) process.exitCode = 1;
}

const reportMaterials = (dir) => ['source.json', 'evidence'].filter((f) => fs.existsSync(path.join(dir, f))).map((f) => (f === 'evidence' ? 'evidence/' : f));

// 수집 직후 에이전트에 맡겨 1~6번 칸을 채우고, 내 버전 출발점까지 한 번에 만든다.
async function completeDissect(o, ag, dir, checkReport) {
  const en = isEn(o);
  if (o.noFill) return { filled: null, mineDir: '', detected: '', failedAgent: '', fallbackAgent: '' };
  const detected = !ag.name && process.stdin.isTTY && process.stdout.isTTY && process.env.REBIZ_NO_AUTO_FILL !== '1'
    ? (findAgentCli('claude') ? 'claude' : findAgentCli('codex') ? 'codex' : '')
    : '';
  let agentName = ag.name || detected;
  if (!agentName) return { filled: null, mineDir: '', detected: '', failedAgent: '', fallbackAgent: '' };
  const reportFile = path.join(dir, 'report.json');
  const base = path.basename(reportFile);
  const includeSpec = !o.dissectOnly;
  const runFill = (name) => delegateReport(o, name, reportFile, {
    what: en
      ? (includeSpec ? 'Fill cells 1–5 and write cell 6 (my-version spec)' : 'Fill unknown cells from collected files')
      : (includeSpec ? '모름 칸 채우고 내 버전 명세(6번 칸)까지 완성하기' : '모름 칸을 읽어 둔 자료만으로 채우기'),
    tag: 'dissect',
    minutes: DEFAULT_MINUTES.fill,
    prompt: fillPrompt({
      report: base,
      skill: fs.existsSync(SKILL_MD) ? SKILL_MD : '',
      checkCmd: `node "${CLI}" check ${base}${includeSpec ? '' : ' --dissect-only'}`,
      materials: reportMaterials(dir),
      includeSpec,
      topic: o.topic || '',
      lang: activeLang(o),
    }),
  });
  let d = await runFill(agentName);
  const other = agentName === 'claude' && findAgentCli('codex') ? 'codex' : agentName === 'codex' && findAgentCli('claude') ? 'claude' : '';
  if (d.res !== 'done' && !d.changed.includes(base) && !ag.name && other && interactive()) {
    say();
    const retry = isYes(await ask(`${T.gold('?')} ${en ? `${AGENT_CLIS[agentName].label} failed. Try ${AGENT_CLIS[other].label} instead? [Y/n] ` : `${AGENT_CLIS[agentName].label} 실행에 실패했습니다. ${AGENT_CLIS[other].label} 로 이어서 진행할까요? [Y/n] `}`));
    if (retry) { agentName = other; d = await runFill(agentName); }
  }
  const otherAfter = agentName === 'claude' && findAgentCli('codex') ? 'codex' : agentName === 'codex' && findAgentCli('claude') ? 'claude' : '';
  if (d.res !== 'done' && !d.changed.includes(base)) {
    if (ag.name && (d.res === 'failed' || d.res === 'timeout')) process.exitCode = 1;
    say();
    rowG(en ? 'Draft kept' : '초안 열기', en
      ? `${AGENT_CLIS[agentName].label} did not edit ${base}; opening the collected draft.`
      : `${AGENT_CLIS[agentName].label} 가 리포트를 채우지 못해 수집된 초안 화면을 먼저 엽니다.`);
    return { filled: null, mineDir: '', detected, failedAgent: agentName, fallbackAgent: otherAfter };
  }
  if (!d.report) {
    if (ag.name && (d.res === 'failed' || d.res === 'timeout')) process.exitCode = 1;
    return { filled: null, mineDir: '', detected, failedAgent: agentName, fallbackAgent: otherAfter };
  }
  const filled = checkReport(d.report, { dissectOnly: o.dissectOnly });
  row(en ? 'Completed' : '완성', en
    ? `observed ${filled.counts.observed} · inferred ${filled.counts.inferred} · unknown ${filled.counts.unknown}${filled.counts.code ? ` · code ${filled.counts.code}` : ''}`
    : `관찰 ${filled.counts.observed} · 추정 ${filled.counts.inferred} · 모름 ${filled.counts.unknown}${filled.counts.code ? ` · 코드 흔적 ${filled.counts.code}` : ''}`);
  for (const e of filled.errors) say(`${en ? 'Error ' : '오류  '}${e}`);
  if (filled.errors.length) {
    rowG(en ? 'Check' : '검사', en
      ? `${filled.errors.length} error(s). Fix ${base} and run: rebiz check ${shown(reportFile)}${o.dissectOnly ? ' --dissect-only' : ''}`
      : `오류 ${filled.errors.length}개. report.json 을 고친 뒤 rebiz check ${shown(reportFile)}${o.dissectOnly ? ' --dissect-only' : ''} 로 다시 검사하세요.`);
    process.exitCode = 1;
    return { filled, mineDir: '', detected, failedAgent: '', fallbackAgent: otherAfter };
  }
  rowG(en ? 'Check passed' : '검사 통과', en ? `${filled.warnings.length} warning(s)` : `경고 ${filled.warnings.length}개`);
  let mineDir = '';
  if (includeSpec && d.report.sections?.my_version?.working_name) {
    try {
      const { buildSite } = await tool('make-site.mjs');
      const builtSite = buildSite(reportFile, path.join(dir, 'my-version'), { topic: o.topic || '', force: o.force });
      mineDir = builtSite.dir;
      rowG(en ? 'My version' : '내 버전', `${shown(mineDir)}  ${T.dim(builtSite.files.join(' · '))}`);
      for (const f of builtSite.clone?.fails || []) say(`${en ? 'Fail ' : '실패  '}[${f.rule}] ${f.file}: ${f.msg}`);
      if (builtSite.clone && !builtSite.clone.fails.length) {
        rowG(en ? 'Overlap check' : '겹침 검사', en
          ? `passed (compared with ${builtSite.clone.stats.sourceLines} source lines, ${builtSite.clone.warns.length} warning(s))`
          : `통과 (원본 글 ${builtSite.clone.stats.sourceLines}줄과 견줌, 경고 ${builtSite.clone.warns.length}건)`);
      }
      if (builtSite.clone?.fails?.length) process.exitCode = 1;
    } catch (e) {
      if (!e.code) throw e;
      rowG(en ? 'My version' : '내 버전', `${en ? 'skipped' : '건너뜀'}: ${e.message}`);
    }
  }
  if (d.res !== 'done') process.exitCode = 1;
  return { filled, mineDir, detected, failedAgent: '', fallbackAgent: otherAfter };
}

// rebiz <주소> 에서 REA 가 없을 때: 바뀔 것을 보여 주고 확인을 받은 뒤에만 설치한다. 실패하거나 거절하면 가벼운 모드로 계속한다.
// 돌려주는 것: { runner (이번 해부에 쓸 REA, 없으면 undefined), note (가벼운 모드인 까닭과 정밀 모드로 가는 방법), stop (dry-run) }
async function offerReaForDissect(o) {
  if (o.light) return {};
  const rp = await planRea(o, planTargets({}).targets, { forDissect: true });
  const later = `다음에 rebiz <주소> 를 돌릴 때 REA 설치에 Y 로 답하거나, 직접 ${REA_HOW}`;
  if (rp.state === 'present') return {};
  if (rp.state === 'skip') return { note: `REA 설치 제안을 건너뛰었습니다 (--no-rea). 정밀 모드로: ${later}` };
  if (rp.state === 'node-too-old') return { note: `REA 는 ${REA_NODE}이 필요한데 지금 Node 는 ${currentNode()} 입니다. Node 를 올리면 정밀 모드로 읽을 수 있습니다.` };
  // 정밀 모드는 브라우저 위에서 REA 를 쓴다. 브라우저 없이 REA 만 받아 봐야 쓸 데가 없으니 묻지 않는다.
  const { findBrowser } = await tool('render.mjs');
  if (o.render === 'off' || !findBrowser()) return {};
  showReaPlan(rp, o);
  say();
  const c = await confirmRea(o);
  if (c === 'dry-run') return { stop: true };
  if (c === 'yes') {
    const a = await applyRea(rp, o);
    say();
    return a.ok ? { runner: a.runner } : { note: `REA 설치가 끝나지 않아 가벼운 모드로 읽었습니다. 정밀 모드로: ${later}` };
  }
  if (c === 'need-yes') say(`물어볼 사람이 없는 터미널이라 REA 는 설치하지 않았습니다. 설치하고 읽으려면 --yes 를 붙이세요 (REA 없이: --no-rea).`);
  say();
  return { note: `REA 를 설치하지 않아 가벼운 모드로 읽었습니다. 정밀 모드로: ${later}` };
}

async function dissectUrl(o) {
  activeLang(o);
  const en = isEn(o);
  const ag = agentArg(o);
  if (!ag) return;
  const { collect, buildDraftFromPages, writeOutputs, outDirFor, Stop } = await tool('collect.mjs');
  const { checkReport } = await tool('check-report.mjs');
  const input = o.rest[0];
  if (!(o.pages >= 1) || !['own', 'third-party'].includes(o.relation)) { say(en ? '--pages must be 1..5 and --relation own|third-party' : '--pages 는 1에서 5, --relation 은 own 또는 third-party'); process.exitCode = 2; return; }
  banner(en ? 'Business Dissection' : '주소 해부', o);
  say(`${T.dim(en ? 'Target' : '대상')}  ${input}`);
  say(T.dim(en ? 'Read   up to 5 public pages (respecting robots.txt · 2s pacing)' : '읽기   robots.txt 확인 후 공개 페이지 최대 5장 · 요청 간격 2초'));
  if (o.relation === 'own') say(T.dim(en ? 'Mode   own site (--own). Code depth enabled.' : '모드   내 것으로 적습니다 (--own). 속 읽기 포함.'));
  say();
  const offer = await offerReaForDissect(o);
  if (o.dryRun || offer.stop) { say(T.dim(en ? 'dry-run: stopping before any download or capture.' : 'dry-run: 아무것도 내려받거나 읽지 않고 여기서 멈춥니다.')); return; }
  const started = Date.now();
  let dir;
  try { dir = path.resolve(o.out || outDirFor(input)); } catch (e) { say(`${T.gold(en ? 'Stopped' : '멈춤')}  ${e.message}`); process.exitCode = 3; return; }
  let c;
  try {
    c = await collect(input, { version: PKG.version, maxPages: o.pages, render: o.render, mode: o.light ? 'light' : 'auto', ...(offer.runner ? { rea: offer.runner } : {}), relation: o.relation, evidenceDir: path.join(dir, 'evidence'), headless: o.headless, onStep: (s) => say(`  ${T.dim('·')} ${s}`) });
  } catch (e) {
    say(`${T.gold(en ? 'Stopped' : '멈춤')}  ${e.message}`);
    process.exitCode = e instanceof Stop ? 3 : 1;
    return;
  }
  if (!c.pages.length) {
    say();
    say(`${T.gold(en ? 'Stopped' : '멈춤')}  ${c.stop ? c.stop.message : (en ? 'No pages could be read.' : '읽은 페이지가 없습니다.')}`);
    say(T.dim(en ? 'Blocked pages are never bypassed. You can pass manual notes to your agent per SKILL.md.' : '막힌 곳은 넘지 않습니다. 직접 본 화면을 메모해 에이전트에게 넘기는 방법이 스킬 문서에 있습니다.'));
    process.exitCode = 3;
    return;
  }
  const built = buildDraftFromPages(c, { relation: o.relation, version: PKG.version });
  writeOutputs(dir, c, built);
  const { counts } = checkReport(built.report);
  say();
  say(en
    ? `${T.dim('Captured')}  ${c.pages.length} page(s) · ${c.log.length} request(s) · ${Math.round((Date.now() - started) / 1000)}s`
    : `${T.dim('읽은 것')}  페이지 ${c.pages.length}장 · 요청 ${c.log.length}번 · ${Math.round((Date.now() - started) / 1000)}초`);
  if (c.stop) say(`${T.dim(en ? 'Notice' : '알림')}    ${c.stop.message}`);
  for (const s of c.skipped) say(`${T.dim(en ? 'Skipped' : '건너뜀')}  ${s.url}  ${T.dim(s.why)}`);
  say(en
    ? `${T.dim('Draft')}     observed ${counts.observed} · inferred ${counts.inferred} · unknown ${counts.unknown}${counts.code ? ` · code ${counts.code}` : ''}`
    : `${T.dim('문장')}    관찰 ${counts.observed} · 추정 ${counts.inferred} · 모름 ${counts.unknown}${counts.code ? ` · 코드 흔적 ${counts.code}` : ''}`);
  const DEPTH = en ? { surface: 'Surface', flow: 'Flow', code: 'Code' } : { surface: '겉 읽기', flow: '흐름 읽기', code: '속 읽기' };
  const STATE = en ? { done: 'read', partial: 'partial', skipped: 'skipped', blocked: 'blocked', failed: 'failed' } : { done: '읽음', partial: '일부만', skipped: '안 함', blocked: '약관이 막음', failed: '실패' };
  say(`${T.dim(en ? 'Depth' : '깊이')}    ${c.deep.mode === 'precise' ? (en ? 'Precise mode (REA)' : '정밀 모드 (REA)') : (en ? 'Light mode' : '가벼운 모드')}`);
  if (c.deep.mode !== 'precise' && offer.note) say(`          ${T.dim(offer.note)}`);
  for (const st of built.report.meta.depth.steps) say(`          ${T.pad(DEPTH[st.key], 10)}${st.state === 'done' || st.state === 'partial' ? T.gold(T.pad(STATE[st.state], 12)) : T.dim(T.pad(STATE[st.state], 12))}${T.dim(st.note || '')}`);
  if (c.render.mode === 'used') say(en
    ? `${T.dim('Browser')}  ${c.render.browser} (${c.render.pages} page(s) with temp profile, closed & cleaned${c.render.blocked ? `, filtered ${c.render.blocked} request(s)` : ''}).`
    : `${T.dim('그려 읽기')} ${c.render.browser} 임시 프로필로 ${c.render.pages}장. 브라우저를 끄고 프로필을 지웠습니다${c.render.blocked ? `. 브라우저 안에서 보내지 않은 요청 ${c.render.blocked}개` : ''}.`);
  else if (c.render.mode === 'failed') say(en ? `${T.dim('Browser')}  failed: ${c.render.error || ''} (used fetched HTML only).` : `${T.dim('그려 읽기')} 실패: ${c.render.error || ''} 받은 HTML 만 읽었습니다.`);
  if (built.thin) {
    say();
    say(`${T.gold(en ? 'Thin capture' : '얇은 결과')}  ${built.read.note}`);
    say(`${T.dim(en ? 'Next' : '다음')}       ${built.read.next}`);
  }
  say();
  const reportFile = path.join(dir, 'report.json');
  const { filled, mineDir, detected, fallbackAgent } = await completeDissect(o, ag, dir, checkReport);
  say();
  await showView(reportFile, { mine: mineDir || undefined, out: path.join(dir, 'report.html'), lang: o.lang, open: o.open });
  say(`${T.dim(en ? 'Saved' : '저장')}    ${tilde(dir)}${path.sep}  report.json · report.html · source.json · requests.json${c.deep.mode === 'precise' ? ' · evidence/' : ''}${mineDir ? ' · my-version/' : ''}`);
  say(T.dim(en ? '          Keep source.json and evidence/ local; never publish raw captured site data.' : '          source.json 과 evidence 폴더는 내 컴퓨터에만 두고 어디에도 올리지 않습니다.'));
  say();
  if (filled && !filled.errors.length) {
    say(T.bold(en ? 'Completed from URL capture to clean-room my-version in one pass' : '해부부터 내 버전 명세까지 한 번에 마쳤습니다'));
    nextLines(
      `rebiz video ${shown(reportFile)}${mineDir ? ` --mine ${shown(mineDir)}` : ''}`,
      mineDir ? '' : `rebiz build ${shown(reportFile)}`,
      en ? `rebiz apply ${shown(reportFile)} --to <my-project-dir>` : `rebiz apply ${shown(reportFile)} --to <내 프로젝트 폴더>`,
    );
  } else {
    const shownPath = shown(reportFile);
    const fillAgent = fallbackAgent || ag.name || 'claude';
    say(T.bold(en ? 'Initial evidence captured — finish interpretation & my-version with an agent' : '여기까지 자동으로 수집했습니다 — 해석과 내 버전은 에이전트로 이어갑니다'));
    if (fallbackAgent) say(`  ${T.pad(en ? 'Run in terminal' : '다른 에이전트로 이어하기', 22)}${T.hi(`rebiz fill ${shownPath} --agent ${fallbackAgent} --yes`)}`);
    else if (!ag.name && !o.noFill && !detected) say(`  ${T.pad(en ? 'Run in terminal' : '터미널에서 자동 완성', 22)}${T.hi(`rebiz fill ${shownPath} --agent ${fillAgent} --yes`)}`);
    say(`  ${T.pad(en ? 'Paste into AI chat' : 'AI 채팅창에 붙여넣기', 22)}${T.ivory(en ? `Finish dissecting ${shownPath} with reversebusiness` : `reversebusiness 로 ${shownPath} 끝까지 해부해 줘`)}`);
    nextLines(`rebiz fill ${shownPath}`);
  }
  promo(o);
}

// ---------- 해부 다음에 하는 일: fill, build, apply, video ----------
const CLI = fileURLToPath(import.meta.url);
const SKILL_MD = path.join(SKILL_SRC, 'SKILL.md');
// 터미널에 보여 줄 경로: 지금 폴더 안이면 상대 경로로, 아니면 ~ 로 줄여서.
const shown = (p) => {
  const abs = path.resolve(p);
  const rel = path.relative(process.cwd(), abs);
  const inside = rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  if (/\s/.test(abs)) return `"${inside ? rel : abs}"`;
  return inside ? rel : tilde(abs);
};
// 이름표가 붙은 한 줄. 이름표의 너비를 맞춘다 (rowG 는 금색 이름표).
const lab = (label) => T.pad(label, Math.max(14, T.width(label) + 2));
const row = (label, text) => say(`${T.dim(lab(label))}${text}`);
const rowG = (label, text) => say(`${T.gold(lab(label))}${text}`);
// 다음에 칠 명령 한 줄 (둘째부터는 "또는")
function nextLines(...cmds) {
  const en = ACTIVE_LANG === 'en';
  say();
  cmds.filter(Boolean).forEach((c, i) => say(`${T.dim(i ? (en ? 'or  ' : '또는') : (en ? 'Next' : '다음'))}  ${T.hi(c)}`));
}
function reportArg(o, usage) {
  const file = o.rest[0] || (fs.existsSync('report.json') ? 'report.json' : '');
  if (!file) { say(`사용: ${usage}`); process.exitCode = 2; return ''; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { say(`리포트를 찾지 못했습니다: ${file}`); say(`사용: ${usage}`); process.exitCode = 2; return ''; }
  try { JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { say(`리포트를 읽을 수 없습니다: ${e.message}`); process.exitCode = 2; return ''; }
  return file;
}
// fill, build, apply 의 --agent: claude 또는 codex 하나. 주지 않으면 맡기지 않는다.
function agentArg(o) {
  if (!o.agents.length) return { name: '' };
  if (o.agents.length > 1 || !AGENT_CLIS[o.agents[0]]) { say(`--agent 는 여기서 claude 또는 codex 하나만 받습니다 (받은 값: ${o.agents.join(', ')}).`); process.exitCode = 2; return null; }
  return { name: o.agents[0] };
}
const isYes = (a) => a === '' || a === 'y' || a === 'yes' || a === 'ㅛ' || a === '예' || a === '네';

// 에이전트에게 한 번 맡긴다. 먼저 무엇을 실행하는지 보여 주고 확인받는다 (--yes 로 생략).
// 돌려주는 것: done, failed, timeout, declined, need-yes, no-cli
// ready 는 확인을 받은 뒤, 에이전트를 부르기 직전에 한 번 돈다 (새 브랜치 만들기 같은 준비). 까닭을 돌려주면 부르지 않는다.
async function delegate(o, name, { what, dir, prompt, check = false, minutes, ready = null }) {
  const en = isEn(o);
  const a = AGENT_CLIS[name];
  const runner = findAgentCli(name);
  if (!runner) { say(); rowG(en ? 'Skipped' : '맡기지 않음', en ? `${a.label} CLI (${a.bin}) not found on this machine.` : `${a.label} 의 실행 파일(${a.bin})을 이 컴퓨터에서 찾지 못했습니다.`); return 'no-cli'; }
  const mins = o.timeout > 0 ? o.timeout : minutes;
  say();
  say(T.ivory(en ? `This step runs your local agent (${a.label}) once using your own agent quota.` : `이 단계는 내 에이전트(${a.label})를 한 번 실행하고, 그 에이전트의 사용량을 씁니다.`));
  say(`  ${T.pad(en ? 'Task' : '할 일', 11)}${what}`);
  say(`  ${T.pad(en ? 'Folder' : '작업 폴더', 11)}${tilde(path.resolve(dir))}`);
  say(`  ${T.pad(en ? 'Scope' : '권한', 11)}${agentScope(name, { check })}`);
  say(`  ${T.pad(en ? 'Timeout' : '시간 한도', 11)}${mins}${en ? 'm' : '분'}`);
  let go = o.yes;
  if (!go && process.stdin.isTTY && process.stdout.isTTY) {
    go = isYes(await ask(`${T.gold('?')} ${en ? `Run ${a.label}? [Y/n] ` : `${a.label} 에 맡길까요? [Y/n] `}`));
    if (!go) { say(en ? 'Skipped.' : '맡기지 않았습니다.'); return 'declined'; }
  } else if (!go) { say(en ? 'Confirmation needed. Re-run with --yes to proceed.' : '확인이 필요합니다. 맡기려면 --yes 를 붙여 다시 실행하세요.'); return 'need-yes'; }
  if (ready) { const why = ready(); if (why) { rowG(en ? 'Stopped' : '멈춤', `${why}`); return 'failed'; } }
  say(T.dim(en ? `Running ${a.label}...` : `${a.label} 를 실행합니다. 두 줄 사이는 에이전트의 출력입니다.`));
  T.rule();
  const r = await runAgent(name, runner, { dir, prompt, minutes: mins, checkCli: check ? CLI : '', readDirs: fs.existsSync(SKILL_MD) ? [path.dirname(SKILL_MD)] : [] });
  T.rule();
  if (r.refused) { rowG(en ? 'Refused' : '실행하지 않음', en ? 'Unsafe permission-skipping option detected; agent not called.' : `권한 확인을 건너뛰는 옵션이 섞여 있어 에이전트를 부르지 않았습니다.`); return 'failed'; }
  if (r.timedOut) { rowG(en ? 'Timed out' : '시간 초과', en ? `Exceeded ${mins}m limit. Increase with --timeout <minutes>.` : `${mins}분을 넘어 에이전트를 껐습니다. 더 길게: --timeout <분>`); return 'timeout'; }
  if (r.code !== 0) { rowG(en ? 'Agent failed' : '에이전트 실패', en ? `exit code ${r.code}${r.error ? ` (${r.error})` : ''}` : `종료 코드 ${r.code}${r.error ? ` (${r.error})` : ''}`); return 'failed'; }
  say(T.dim(en ? `Agent finished (${Math.round(r.ms / 1000)}s).` : `에이전트가 끝났습니다 (${Math.round(r.ms / 1000)}초).`));
  return 'done';
}

// 폴더의 파일 목록과 크기, 고친 때. 에이전트가 무엇을 바꿨는지 보려고 맡기기 전후에 찍는다.
function snapshot(dir) {
  const out = new Map();
  const walk = (d, depth) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.DS_Store' || e.name === 'node_modules' || e.name === '.git' || out.size > 5000) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (depth < 4) walk(p, depth + 1); } else if (e.isFile()) { const st = fs.statSync(p); out.set(path.relative(dir, p).split(path.sep).join('/'), `${st.size}:${st.mtimeMs}`); }
    }
  };
  walk(dir, 0);
  return out;
}
function changedSince(dir, before) {
  const after = snapshot(dir);
  return [...new Set([...before.keys(), ...after.keys()])].filter((k) => before.get(k) !== after.get(k)).sort();
}

// 리포트 한 파일을 에이전트에게 맡긴다. 맡기기 전의 사본을 남기고, 돌아온 파일을 읽을 수 없으면 되돌린다.
// 돌려주는 것: { res, report, changed, backup }  (report 는 맡긴 뒤의 내용, 맡기지 않았으면 null)
async function delegateReport(o, name, file, { what, prompt, minutes, tag }) {
  const dir = path.dirname(path.resolve(file));
  const base = path.basename(file);
  const backup = path.join(dir, `${base.replace(/\.json$/i, '')}.before-${tag}.json`);
  fs.copyFileSync(file, backup);
  const snap = snapshot(dir);
  const res = await delegate(o, name, { what, dir, prompt, check: true, minutes });
  if (['no-cli', 'need-yes', 'declined'].includes(res)) { fs.rmSync(backup, { force: true }); return { res, report: null, changed: [], backup: '' }; }
  let report = null;
  try { report = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* 아래에서 되돌린다 */ }
  if (!report) {
    fs.copyFileSync(backup, file);
    rowG('되돌림', `에이전트가 남긴 ${base} 를 읽을 수 없어 맡기기 전의 내용으로 되돌렸습니다.`);
    return { res: 'failed', report: null, changed: [], backup };
  }
  const changed = changedSince(dir, snap).filter((f) => f !== path.basename(backup));
  row('바뀐 파일', `${changed.length ? changed.join(', ') : '없음'}`);
  const others = changed.filter((f) => f !== base);
  if (others.length) rowG('알림', `리포트 말고 다른 파일도 바뀌었습니다: ${others.join(', ')}. 직접 열어 확인하세요.`);
  row('맡기기 전', `${shown(backup)}`);
  return { res, report, changed, backup };
}

async function fill(o) {
  activeLang(o);
  const en = isEn(o);
  const file = reportArg(o, 'rebiz fill <report.json> [--agent claude|codex] [--yes]');
  if (!file) return;
  const ag = agentArg(o);
  if (!ag) return;
  banner(en ? 'Fill Unknowns' : '모름 칸 채우기', o);
  const { checkReport } = await tool('check-report.mjs');
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = checkReport(r, { dissectOnly: true });
  const listed = Array.isArray(r.sections && r.sections.unknowns) ? r.sections.unknowns.length : 0;
  const dir = path.dirname(path.resolve(file));
  const base = path.basename(file);
  const materials = reportMaterials(dir);
  row(en ? 'Report' : '리포트', `${shown(file)}`);
  row(en ? 'Statements' : '문장', en
    ? `observed ${before.counts.observed} · inferred ${before.counts.inferred} · unknown ${before.counts.unknown}${before.counts.code ? ` · code ${before.counts.code}` : ''}`
    : `관찰 ${before.counts.observed} · 추정 ${before.counts.inferred} · 모름 ${before.counts.unknown}${before.counts.code ? ` · 코드 흔적 ${before.counts.code}` : ''}`);
  row(en ? 'Unknowns' : '모르는 것', en
    ? `${listed} listed${before.myVersion === 'empty' ? ' · cell 6 (my_version) empty' : ''}`
    : `따로 정리한 것 ${listed}건${before.myVersion === 'empty' ? ' · 6번 칸(내 버전 명세)은 아직 비어 있음' : ''}`);
  row(en ? 'Materials' : '읽어 둔 자료', `${materials.length ? materials.join(', ') : (en ? 'none (using report & evidence ledger only)' : '없음 (리포트의 문장과 근거 장부만 봅니다)')}`);
  const sentence = en
    ? `Use reversebusiness to fill the remaining unknowns in ${shown(file)} from collected files, then run rebiz check`
    : `"reversebusiness 로 ${shown(file)} 의 모름 칸을 이어서 채워 줘. 이미 읽어 둔 자료만 쓰고, 끝나면 rebiz check 로 검사해 줘"`;
  const after = () => nextLines(`rebiz build ${shown(file)}`, en ? `rebiz apply ${shown(file)} --to <my-project-dir>` : `rebiz apply ${shown(file)} --to <내 프로젝트 폴더>`);
  const paste = () => {
    say();
    say(T.bold(en ? 'Open your AI coding tool and paste this prompt' : '에이전트를 열고 이 한 문장을 붙여 넣으세요'));
    say(`  ${T.hi(sentence)}`);
    if (!ag.name) say(T.dim(en ? `  Or run from terminal: rebiz fill ${shown(file)} --agent claude --yes` : `  rebiz 가 대신 맡기게 하려면: rebiz fill ${shown(file)} --agent claude   (또는 codex. 확인 뒤 한 번 실행합니다)`));
    say(T.dim(en ? '  Never re-scrapes the site; unknowns that cannot be confirmed stay unknown.' : '  새로 사이트를 읽지 않습니다. 자료로 알 수 없는 칸은 모름으로 남습니다.'));
    after();
  };
  if (!before.counts.unknown && !listed) { say(); say(en ? 'No unknown cells left to fill.' : '채울 모름 칸이 없습니다.'); after(); return; }
  if (!ag.name) { paste(); return; }
  const d = await delegateReport(o, ag.name, file, {
    what: en ? `Fill unknowns in ${base} using collected materials only` : `모름 칸을 읽어 둔 자료만으로 채우기 (고치는 파일은 ${base} 하나, 새로 사이트를 읽지 않음)`, tag: 'fill', minutes: DEFAULT_MINUTES.fill,
    prompt: fillPrompt({ report: base, skill: fs.existsSync(SKILL_MD) ? SKILL_MD : '', checkCmd: `node "${CLI}" check ${base} --dissect-only`, materials, lang: activeLang(o) }),
  });
  if (!d.report) { if (d.res === 'failed' || d.res === 'timeout') { process.exitCode = 1; return; } paste(); return; }
  const now = checkReport(d.report, { dissectOnly: true });
  const diff = (k) => { const n = now.counts[k] - before.counts[k]; return n ? ` (${n > 0 ? '+' : ''}${n})` : ''; };
  row(en ? 'Statements' : '문장', en
    ? `observed ${now.counts.observed}${diff('observed')} · inferred ${now.counts.inferred}${diff('inferred')} · unknown ${now.counts.unknown}${diff('unknown')}`
    : `관찰 ${now.counts.observed}${diff('observed')} · 추정 ${now.counts.inferred}${diff('inferred')} · 모름 ${now.counts.unknown}${diff('unknown')}`);
  for (const e of now.errors) say(`${en ? 'Error ' : '오류  '}${e}`);
  if (now.errors.length) { rowG(en ? 'Check' : '검사', en ? `${now.errors.length} error(s). Fix ${base} and run rebiz check ${shown(file)} --dissect-only` : `오류 ${now.errors.length}개. ${base} 를 고친 뒤 rebiz check ${shown(file)} --dissect-only 로 다시 검사하세요.`); process.exitCode = 1; return; }
  rowG(en ? 'Check passed' : '검사 통과', en ? `${now.warnings.length} warning(s)` : `경고 ${now.warnings.length}개`);
  if (d.res !== 'done') process.exitCode = 1;
  after();
}

async function build(o) {
  activeLang(o);
  const en = isEn(o);
  const file = reportArg(o, en ? 'rebiz build <report.json> [--out <dir>] [--topic "..."] [--agent claude|codex]' : 'rebiz build <report.json> [--out <폴더>] [--topic "내 사업 주제"] [--agent claude|codex]');
  if (!file) return;
  const ag = agentArg(o);
  if (!ag) return;
  banner(en ? 'Build My Version' : '새 사이트 만들기', o);
  const { buildSite } = await tool('make-site.mjs');
  const { openFile } = await tool('build-view.mjs');
  const base = path.basename(file);
  const topicArg = o.topic ? ` --topic "${o.topic}"` : '';
  row(en ? 'Report' : '리포트', `${shown(file)}`);
  let r = null;
  for (let attempt = 0; attempt < 2 && !r; attempt += 1) {
    try { r = buildSite(file, o.out, { topic: o.topic || '', force: o.force }); } catch (e) {
      if (!e.code) throw e;
      if (e.code === 'spec-empty' && attempt === 0) {
        rowG(en ? 'Stopped' : '멈춤', en ? 'Cell 6 (my_version) is empty; fill it first so the new site can be generated cleanly.' : `6번 칸(내 버전 명세)이 비어 있어서 아직 만들지 않았습니다. 새 사이트는 그 명세만 보고 만듭니다.`);
        const how = () => {
          say();
          say(T.bold(en ? 'How to fill cell 6' : '6번 칸을 채우는 방법'));
          if (!ag.name) say(`  ${T.pad(en ? 'Run' : '맡기기', 10)}rebiz build ${shown(file)}${topicArg} --agent claude   ${T.dim(en ? '(or codex)' : '(또는 codex. 확인 뒤 한 번 실행합니다)')}`);
          say(`  ${T.pad(en ? 'Chat prompt' : '붙여 넣기', 10)}${T.hi(en ? `Write cell 6 (my_version) for ${shown(file)} with reversebusiness${o.topic ? ` for topic: ${o.topic}` : ''}` : `"reversebusiness 로 ${shown(file)} 의 6번 칸(내 버전 명세)을 써 줘${o.topic ? `. 내 사업의 주제는 ${o.topic}` : ''}"`)}`);
          nextLines(`rebiz build ${shown(file)}${topicArg}`);
        };
        if (!ag.name) { how(); process.exitCode = 2; return; }
        const d = await delegateReport(o, ag.name, file, {
          what: en ? `Write cell 6 (my_version) in ${base}` : `6번 칸(내 버전 명세) 쓰기 (고치는 파일은 ${base} 하나, 1~5번 칸의 문장만 봄)`, tag: 'spec', minutes: DEFAULT_MINUTES.spec,
          prompt: specPrompt({ report: base, skill: fs.existsSync(SKILL_MD) ? SKILL_MD : '', checkCmd: `node "${CLI}" check ${base}`, topic: o.topic || '', lang: activeLang(o) }),
        });
        if (!d.report) { how(); process.exitCode = d.res === 'failed' || d.res === 'timeout' ? 1 : 2; return; }
        continue;
      }
      rowG('멈춤', e.code === 'exists' ? `폴더에 이미 파일이 있습니다: ${shown(e.dir)}` : e.message);
      for (const m of e.errors || []) row('', m);
      if (e.code === 'spec-empty') row('', '에이전트가 6번 칸을 채우지 못했습니다. 리포트를 열어 확인하세요.');
      if (e.code === 'spec-errors') row('', `${base} 의 6번 칸을 고친 뒤 rebiz check ${shown(file)} 로 검사하고 다시 실행하세요.`);
      if (e.code === 'names') row('', '새 사이트에는 대상의 이름과 클론이라는 말을 쓰지 않습니다. 그 말을 빼고 다시 실행하세요.');
      if (e.code === 'exists') row('', '다른 폴더를 --out 으로 주거나, 덮어써도 되면 --force 를 붙이세요.');
      process.exitCode = e.code === 'exists' ? 2 : 1;
      return;
    }
  }
  if (!r) { process.exitCode = 1; return; }
  const index = path.join(r.dir, 'index.html');
  rowG('만든 곳', `${shown(r.dir)}  ${T.dim(r.files.join(' · '))}`);
  row('구역', `${r.sections}개, ${r.synthesized ? '리포트에 뼈대가 없어 기본 순서로' : '배운 순서 그대로 (가져오지 않기로 한 구역은 뺌)'}`);
  if (o.topic) row('주제', `${o.topic}`);
  row('쓴 재료', `6번 칸의 명세, 구역의 종류와 순서, 이 도구의 안내 문구와 중립 디자인. 대상의 문구, 이미지, 이름, 색은 쓰지 않았습니다.`);
  if (r.linked) row('리포트', `뼈대 ${r.linked}곳에 내 구역의 선택자를 적었습니다 (해부 화면의 비교 칸이 씁니다).`);
  row('열기', `${shown(index)}  ${T.dim('(브라우저로 이 파일을 열면 됩니다)')}`);
  if (o.open && process.stdout.isTTY) openFile(index);
  if (!r.clone) row('겹침 검사', `건너뜀: 리포트 옆에 source.json 이 없습니다. 원본 글 묶음이 있으면 rebiz clone-check ${shown(r.dir)} --source <source.json>`);
  else {
    for (const f of r.clone.fails) say(`실패  [${f.rule}] ${f.file}: ${f.msg}`);
    for (const w of r.clone.warns) say(`경고  [${w.rule}] ${w.file}: ${w.msg}`);
    if (r.clone.fails.length) { rowG('겹침 검사', `겹침 ${r.clone.fails.length}건. 그 부분을 내 말로 바꾼 뒤 rebiz clone-check ${shown(r.dir)} --source ${shown(r.clone.file)} 로 다시 검사하세요.`); process.exitCode = 1; return; }
    rowG('겹침 검사', `통과 (원본 글 ${r.clone.stats.sourceLines}줄과 견줌, 경고 ${r.clone.warns.length}건). 색과 배치의 닮음은 두 화면을 나란히 놓고 직접 보세요.`);
  }
  say(T.dim('점선 자리의 안내를 내 말로 바꾸면 됩니다. 에이전트에게: "이 폴더의 점선 자리를 내 사업에 맞게 채워 줘"'));
  nextLines(`rebiz view ${shown(file)} --mine ${shown(r.dir)}`, `rebiz video ${shown(file)} --mine ${shown(r.dir)}`);
}

// git 을 한 번 부른다. 출력은 다듬지 않고 돌려준다.
const git = (dir, ...args) => { const r = spawnSync('git', ['-c', 'core.quotepath=false', '-C', dir, ...args], { encoding: 'utf8' }); return { ok: r.status === 0, out: String(r.stdout || ''), err: String(r.stderr || '').trim() }; };
// 맡기기 전에 본다: git 저장소인지, 커밋이 있는지, 작업 트리가 깨끗한지 (우리 계획 폴더는 빼고).
function gitGate(dir, planDir) {
  const inside = git(dir, 'rev-parse', '--is-inside-work-tree');
  if (!inside.ok || inside.out.trim() !== 'true') return { stop: 'git 저장소가 아닙니다. 되돌릴 수 있을 때만 맡깁니다. 이 폴더에서 git init 을 하고 지금 상태를 커밋한 뒤 다시 실행하세요.' };
  if (!git(dir, 'rev-parse', '--verify', 'HEAD').ok) return { stop: '커밋이 하나도 없습니다. 지금 상태를 먼저 커밋한 뒤 다시 실행하세요.' };
  const prefix = git(dir, 'rev-parse', '--show-prefix').out.trim();
  const dirty = git(dir, 'status', '--porcelain', '--untracked-files=all').out.split('\n').filter((l) => l.length > 3).filter((l) => !l.slice(3).replace(/^"|"$/g, '').startsWith(`${prefix}${planDir}/`));
  if (dirty.length) return { stop: '작업 트리가 깨끗하지 않습니다. 커밋하지 않은 변경과 섞이면 되돌리기 어렵습니다. 먼저 커밋하거나 치운 뒤 다시 실행하세요.', dirty };
  return { branch: git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').out.trim() };
}
function newBranch(dir) {
  const d = new Date();
  const stem = `rebiz/apply-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  for (let i = 1; i <= 30; i += 1) {
    const name = i === 1 ? stem : `${stem}-${i}`;
    if (git(dir, 'rev-parse', '--verify', '--quiet', `refs/heads/${name}`).ok) continue;
    const r = git(dir, 'checkout', '-b', name);
    return r.ok ? { name } : { error: r.err };
  }
  return { error: '브랜치 이름을 정하지 못했습니다' };
}

async function apply(o) {
  const usage = 'rebiz apply <report.json> --to <내 프로젝트 폴더> [--page <파일>] [--url http://localhost:포트] [--agent claude|codex]';
  const file = reportArg(o, usage);
  if (!file) return;
  const to = o.to || o.rest[1] || '';
  if (!to) { say(`사용: ${usage}`); process.exitCode = 2; return; }
  const ag = agentArg(o);
  if (!ag) return;
  banner('내 프로젝트에 적용');
  const { makePlan, writePlan, PlanStop, PLAN_DIR, stateName, howName } = await tool('apply-plan.mjs');
  const { findSource } = await tool('make-site.mjs');
  const { checkClone } = await tool('check-clone.mjs');
  const { kindName } = await tool('kinds.mjs');
  const src = findSource(file);
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const own = ((report.meta || {}).target || {}).relation === 'own';
  const root = path.resolve(to);
  const again = `rebiz apply ${shown(file)} --to ${shown(root)}`;
  row('리포트', `${shown(file)}`);
  row('내 프로젝트', `${shown(root)}`);
  const planOpts = { page: o.page || '', url: o.url || '', render: o.render, version: PKG.version, source: src && src.source };
  let plan;
  try { plan = await makePlan(file, root, planOpts); } catch (e) {
    if (!(e instanceof PlanStop)) throw e;
    rowG('멈춤', `${e.message}`);
    if (e.code === 'no-page' || e.code === 'shell-page') {
      say(`  ${T.dim('첫 화면 파일을 알려 주기')}    ${again} --page ${(e.hints || [])[0] || '<파일>'}`);
      say(`  ${T.dim('개발 서버를 띄우고 주소로')}   ${again} --url http://localhost:3000   ${T.dim('(내 컴퓨터 주소만 받습니다)')}`);
    }
    process.exitCode = 2;
    return;
  }
  const out = writePlan(root, plan);
  const c = plan.cmp.counts;
  row('내 첫 화면', `${plan.page.ref}  ${T.dim(howName(plan.page.how))}`);
  say();
  say(T.dim('배운 뼈대와 내 첫 화면을 견준 표 (구역의 종류는 규칙으로 붙인 추정입니다)'));
  const w1 = Math.max(...plan.cmp.rows.map((r) => T.width(r.target.name))) + 2;
  const w2 = Math.max(...plan.cmp.rows.map((r) => T.width(kindName(r.target.kind)))) + 2;
  for (const r of plan.cmp.rows) {
    const st = T.pad(stateName(r.state), 14);
    const note = r.state === 'same' ? `내 ${r.mine.n}번째 구역` : r.state === 'moved' ? `내 ${r.mine.n}번째 구역. 배운 순서로는 ${r.after ? `내 ${r.after.n}번째 구역 다음` : '맨 위'}` : r.state === 'missing' ? `넣을 자리: ${r.after ? `내 ${r.after.n}번째 구역 다음` : '맨 위'}` : '';
    say(`  ${T.dim(String(r.target.n).padStart(2, '0'))}  ${T.pad(r.target.name, w1)}${T.dim(T.pad(kindName(r.target.kind), w2))}${r.state === 'missing' ? T.gold(st) : r.state === 'moved' ? T.hi(st) : T.dim(st)}${T.dim(note)}`);
  }
  if (plan.cmp.extra.length) say(T.dim(`  내 첫 화면에만 있는 구역: ${plan.cmp.extra.map((m) => `${m.n}번째 ${m.name}`).join(', ')} (그대로 둡니다)`));
  say();
  rowG('빈칸', `${c.missing}곳 · 순서 다른 곳 ${c.moved}곳 · 있음 ${c.same}곳  ${T.dim(`(배운 구역 ${c.target}개, 내 구역 ${c.mine}개)`)}`);
  rowG('계획', `${shown(out.md)}  ${T.dim('· plan.json')}`);
  const sentence = `"${shown(out.md)} 를 읽고 이 프로젝트의 첫 화면에 적용해 줘. 새 브랜치에서 하고, 문구는 내 말로 새로 쓰고, 커밋과 배포는 하지 마"`;
  const done = () => nextLines(`rebiz view ${shown(file)}`, `rebiz video ${shown(file)}`);
  const paste = () => {
    say();
    say(T.bold('코드를 고치는 일은 에이전트 몫입니다. 프로젝트 폴더에서 에이전트를 열고 이 한 문장을 붙여 넣으세요'));
    say(`  ${T.hi(sentence)}`);
    if (!ag.name) say(T.dim(`  rebiz 가 대신 맡기게 하려면: ${again} --agent claude   (또는 codex. git 저장소의 새 브랜치에서, 확인 뒤 한 번 실행합니다)`));
    done();
  };
  if (!c.missing && !c.moved) { say(); say('배운 구역이 내 첫 화면에 같은 순서로 다 있습니다. 고칠 것이 없습니다.'); done(); return; }
  if (!ag.name) { paste(); return; }
  if (!findAgentCli(ag.name)) { say(); rowG('맡기지 않음', `${AGENT_CLIS[ag.name].label} 의 실행 파일(${AGENT_CLIS[ag.name].bin})을 이 컴퓨터에서 찾지 못했습니다.`); paste(); return; }
  // 맡기기 전에: git 저장소이고 작업 트리가 깨끗해야 한다. 아니면 멈춘다.
  const gate = gitGate(root, PLAN_DIR);
  if (gate.stop) {
    say();
    rowG('멈춤', `${gate.stop}`);
    for (const l of (gate.dirty || []).slice(0, 8)) say(`      ${l}`);
    if ((gate.dirty || []).length > 8) say(T.dim(`      ... 그 밖에 ${gate.dirty.length - 8}개`));
    say(T.dim(`      계획은 ${shown(out.md)} 에 남아 있습니다. 준비되면: ${again} --agent ${ag.name}`));
    process.exitCode = 1;
    return;
  }
  say();
  row('git', `지금 브랜치 ${gate.branch}, 작업 트리 깨끗함. 확인하면 새 브랜치 rebiz/apply-날짜 를 만들고 그 위에서만 고칩니다. 커밋, push, 배포는 하지 않습니다.`);
  const pageRef = plan.page.how === 'url-rendered' || plan.page.how === 'url-html' ? `${plan.page.ref} 로 보이는 화면` : plan.page.ref;
  // 확인을 받은 뒤에만 브랜치를 만든다.
  let branch = null;
  const res = await delegate(o, ag.name, {
    what: `${PLAN_DIR}/plan.md 의 빈칸을 첫 화면에 넣기 (새 브랜치에서, 커밋 없이)`, dir: root, minutes: DEFAULT_MINUTES.apply,
    prompt: applyPrompt({ plan: `${PLAN_DIR}/plan.md`, page: pageRef, lang: activeLang(o) }),
    ready: () => { branch = newBranch(root); if (branch.error) return `새 브랜치를 만들지 못했습니다: ${branch.error}`; rowG('브랜치', `${branch.name} 를 만들었습니다  ${T.dim(`(원래 브랜치: ${gate.branch})`)}`); return ''; },
  });
  if (['no-cli', 'need-yes', 'declined'].includes(res)) { paste(); return; }
  if (!branch || branch.error) { process.exitCode = 1; return; }
  const stat = git(root, 'diff', '--stat', 'HEAD').out.trimEnd();
  const tracked = git(root, 'diff', '--name-only', '--relative', 'HEAD').out.split('\n').filter(Boolean);
  const fresh = git(root, 'ls-files', '--others', '--exclude-standard').out.split('\n').filter(Boolean);
  say(T.dim('git diff --stat'));
  say(stat ? stat.split('\n').map((l) => `  ${l}`).join('\n') : '  바뀐 파일이 없습니다.');
  if (fresh.length) say(`  ${T.dim('새 파일')}  ${fresh.slice(0, 12).join(', ')}${fresh.length > 12 ? ` 그 밖에 ${fresh.length - 12}개` : ''}`);
  // 고친 뒤에 다시 견준다 (파일로 읽은 첫 화면일 때).
  if (plan.page.how === 'file' || plan.page.how === 'source-file') {
    try { const again2 = await makePlan(file, root, planOpts); row('다시 견줌', `빈칸 ${c.missing}곳에서 ${again2.cmp.counts.missing}곳으로, 순서 다른 곳 ${c.moved}곳에서 ${again2.cmp.counts.moved}곳으로`); } catch { /* 다시 읽지 못하면 넘어간다 */ }
  }
  let overlap = false;
  if (!src) row('겹침 검사', `건너뜀: 리포트 옆에 source.json 이 없습니다.`);
  else {
    const cc = checkClone(root, src.source, { only: [...tracked, ...fresh] });
    for (const f of cc.fails) say(`실패  [${f.rule}] ${f.file}: ${f.msg}`);
    if (cc.fails.length) { overlap = !own; rowG('겹침 검사', `바뀐 파일에서 겹침 ${cc.fails.length}건${own ? ' (대상이 내 것이라 참고용입니다)' : '. 그 부분을 내 말로 바꾸세요'}.`); } else rowG('겹침 검사', `통과 (바뀐 파일 ${cc.stats.files}개를 원본 글 ${cc.stats.sourceLines}줄과 견줌)`);
  }
  say(T.dim(`커밋하지 않았습니다. 바뀐 것을 직접 보고(git -C ${shown(root)} diff) 커밋할지 정하세요. 원래 브랜치는 ${gate.branch} 입니다.`));
  if (res !== 'done' || overlap) process.exitCode = 1;
  done();
}

async function video(o) {
  activeLang(o);
  const en = isEn(o);
  const file = reportArg(o, en ? 'rebiz video <report.json> [--out <file>] [--mine <dir>] [--lang en|ko]' : 'rebiz video <report.json> [--out <파일>] [--mine <내 버전 폴더>] [--lang en|ko]');
  if (!file) return;
  banner(en ? 'Dissection Video' : '해부 영상', o);
  const { recordVideo, VideoStop } = await tool('video.mjs');
  const effLang = activeLang(o);
  row(en ? 'Report' : '리포트', `${shown(file)}${o.mine ? `  ${T.dim(en ? 'Mine' : '내 버전')} ${shown(o.mine)}` : ''}`);
  let r;
  try { r = await recordVideo(file, { out: o.out || '', mine: o.mine || '', lang: effLang, onStep: (s) => say(`  ${T.dim('·')} ${s.trim()}`) }); } catch (e) {
    if (!(e instanceof VideoStop) && !/내 버전 폴더|viewer/.test(String(e.message))) throw e;
    rowG(en ? 'Stopped' : '멈춤', `${e.message}`);
    row(en ? 'Alternative' : '대신', en ? `Open rebiz view ${shown(file)}${o.mine ? ` --mine ${shown(o.mine)}` : ''} and click "Save video (9:16)".` : `rebiz view ${shown(file)}${o.mine ? ` --mine ${shown(o.mine)}` : ''} 로 해부 화면을 열고 "영상으로 저장 (9:16)" 단추를 누르세요.`);
    process.exitCode = e.code === 'no-browser' ? 3 : 1;
    return;
  }
  rowG(en ? 'Video' : '영상', `${shown(r.file)}${r.overwrote ? T.dim(en ? '  (overwrote existing)' : '  (있던 파일을 덮어씀)') : ''}`);
  row(en ? 'Format' : '형식', en ? `${r.format} · ${r.width}x${r.height} · ${r.seconds ? `${r.seconds}s` : `~${Math.round(r.expectedSeconds)}s`} · ${(r.bytes / 1048576).toFixed(1)} MB · silent` : `${r.format} · ${r.width}x${r.height} · ${r.seconds ? `${r.seconds}초` : `약 ${Math.round(r.expectedSeconds)}초`} · ${(r.bytes / 1048576).toFixed(1)} MB · 소리 없음`);
  if (r.renamed) row('', T.dim(en ? `Matched extension to browser output (${r.format}).` : `이 브라우저가 만든 형식이 ${r.format} 라서 파일 이름의 끝을 맞췄습니다.`));
  row('', T.dim(en ? `${r.browser} recorded headless with a throwaway profile (0 outbound requests).` : `${r.browser} 를 임시 프로필로 띄워 그렸고, 브라우저를 끄고 프로필을 지웠습니다. 바깥으로 나간 요청 0${r.blocked ? ` (보내지 않고 막은 요청 ${r.blocked}개)` : ''}.`));
  if (r.width !== 1080 || r.height !== 1920) { rowG(en ? 'Notice' : '알림', en ? 'Dimensions are not 1080x1920; inspect file.' : `크기가 1080x1920 이 아닙니다. 파일을 열어 확인하세요.`); process.exitCode = 1; }
  nextLines(o.mine ? `rebiz apply ${shown(file)} --to ${en ? '<my-project-dir>' : '<내 프로젝트 폴더>'}` : `rebiz build ${shown(file)}`);
}

// 다음 판에 들어올 명령: 지금은 무엇이 될지와 그때까지 쓸 방법을 알려 준다.
function planned(c) {
  banner();
  say(`${T.bold(c.usage)} 는 다음 판(${c.planned})에 들어옵니다: ${c.text}.`);
  say(`${T.dim('지금은')}  ${c.now}`);
  process.exitCode = 2;
}

// 스킬 폴더의 도구에 인자를 그대로 넘기는 명령 (draft, clone-check, collect)
const first = commandOf(process.argv[2]);
if (first && first.pass) {
  const r = spawnSync(process.execPath, [path.join(TOOLS, first.pass), ...process.argv.slice(3)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
if (first && first.planned) planned(first);
else {
  const o = parse(process.argv.slice(2));
  activeLang(o);
  const en = isEn(o);
  const run = { help: () => help(o), version: () => say(PKG.version), remove: () => remove(o), view: () => view(o), check: () => check(o), fill: () => fill(o), build: () => build(o), apply: () => apply(o), video: () => video(o), demo: async () => { banner(en ? 'Example Dissection' : '예시 해부', o); await showDemo(o); promo(o); }, dissect: () => dissectUrl(o), install: () => install(o) };
  if (o.bad) { say(`${en ? 'Unknown argument:' : '모르는 인자:'} ${o.bad}`); say(); help(o); process.exitCode = 2; }
  else if (o.cmd === 'dissect' && !o.rest.length) { say(en ? 'Usage: rebiz <URL>   (e.g. rebiz https://example.com --own)' : '사용: rebiz <주소>   (예: rebiz https://example.com --own)'); process.exitCode = 2; }
  else await run[o.cmd]();
}
