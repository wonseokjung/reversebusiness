// CONNECT AI LAB terminal banner, shared by every AI employee kit (one file, copied as lib/banner.mjs; do not edit per kit).
// Black x gold only: brand gold #D6892A rising to #F2B45A, pale gold and ivory #EBE2D2. No rainbow, no emoji.
// Order: CONNECT AI LAB in block letters, a gold AI BUSINESS line, the tagline by AI Mentor Jay, then this kit's AI employee.
// The employee comes from lib/brand.json next to this file: {"kit": "...", "employee": {"ko": "AI ... 직원", "en": "AI ..."}}.
// No color (NO_COLOR, or not a terminal, e.g. a log file or an agent reading the output): one plain line.
import fs from 'node:fs';

const FONT = {
  C: [' ██████╗', '██╔════╝', '██║     ', '██║     ', '╚██████╗', ' ╚═════╝'],
  O: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  N: ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
  E: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'],
  T: ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   '],
  A: [' █████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
  I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  L: ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗', '╚══════╝'],
  B: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██████╔╝', '╚═════╝ '],
  ' ': ['  ', '  ', '  ', '  ', '  ', '  '],
};
const STOPS = [[214, 137, 42], [228, 160, 72], [242, 180, 90], [246, 210, 152], [238, 230, 216]];
const IVORY = [235, 226, 210], INK = [10, 9, 8];

export const TEXT = {
  ko: {line: 'AI 비즈니스를 배우는 가장 멋진 방법', by: 'by AI Mentor Jay', second: '모두를 위한 AI 교육'},
  en: {line: 'The coolest way to learn AI business', by: 'by AI Mentor Jay', second: 'AI education for everyone'},
};
export const FONT_ROWS = FONT;

export const colorOn = () => !process.env.NO_COLOR && (!!process.env.FORCE_COLOR || !!process.stdout.isTTY);
const rgb = ([r, g, b], t) => colorOn() ? `\x1b[38;2;${r};${g};${b}m${t}\x1b[0m` : t;
const plate = (t) => colorOn() ? `\x1b[1;48;2;${STOPS[0].join(';')};38;2;${INK.join(';')}m${t}\x1b[0m` : t;
const bold = (t) => colorOn() ? `\x1b[1m${t}\x1b[0m` : t;
const dim = (t) => colorOn() ? `\x1b[2m${t}\x1b[0m` : t;
function at(x) {
  const p = Math.max(0, Math.min(1, x)) * (STOPS.length - 1), i = Math.min(Math.floor(p), STOPS.length - 2), f = p - i;
  return STOPS[i].map((v, k) => Math.round(v + (STOPS[i + 1][k] - v) * f));
}
function block(word) {
  const rows = Array.from({length: 6}, (_, r) => [...word].map((ch) => (FONT[ch] || FONT[' '])[r]).join(''));
  const w = Math.max(...rows.map((r) => [...r].length));
  return rows.map((row) => [...row].map((ch, x) => (ch === ' ' ? ' ' : rgb(at(x / w), ch))).join(''));
}
export const gold = (t) => rgb(STOPS[0], t);
export const dimmed = dim;
export const tint = (i, n, t) => rgb(at(n > 1 ? i / (n - 1) : 0), t);

function readJson(rel) { try { return JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8')); } catch { return null; } }
// this kit's AI employee (lib/brand.json) and version (package.json)
export function brand() {
  const b = readJson('./brand.json') || {}, pkg = readJson('../package.json') || {};
  return {kit: b.kit || pkg.name || '', version: pkg.version || '', employee: b.employee || null};
}
// Korean when asked (CONNECT_AI_LANG=ko) or when the system language is Korean; English otherwise
export function lang(want) {
  const v = String(want || process.env.CONNECT_AI_LANG || process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || '').toLowerCase();
  if (v.startsWith('ko')) return 'ko';
  if (v.startsWith('en') || v === 'c' || v.startsWith('c.')) return 'en';
  try { return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('ko') ? 'ko' : 'en'; } catch { return 'en'; }
}
export function employeeName(l = lang()) { const e = brand().employee; return e ? (e[l] || e.en || e.ko || '') : ''; }

// one short line, no color: for logs, agents and NO_COLOR
export function brandLine(opts = {}) {
  const l = lang(opts.lang), t = TEXT[l], e = opts.employee ?? employeeName(l);
  return ['CONNECT AI LAB', 'AI BUSINESS', t.line, t.by, e].filter(Boolean).join(' · ');
}

export function banner(cols = process.stdout.columns || +process.env.COLUMNS || 80, opts = {}) {
  if (typeof cols === 'object' && cols) { opts = cols; cols = process.stdout.columns || +process.env.COLUMNS || 80; }
  // a log file or an agent reading the output gets one line, not 12 rows of block letters
  if (!colorOn()) return '\n' + brandLine(opts) + '\n';
  const l = lang(opts.lang), t = TEXT[l], b = brand(), e = opts.employee ?? employeeName(l);
  const lines = [''];
  const wide = cols >= 108;
  for (const word of wide ? ['CONNECT AI LAB'] : ['CONNECT', 'AI LAB']) for (const r of block(word)) lines.push('  ' + r);
  const rule = Math.max(8, Math.min(wide ? 96 : 52, cols - 4) - 15);
  lines.push('');
  lines.push('  ' + bold(rgb(STOPS[2], 'AI BUSINESS')) + '  ' + rgb(STOPS[0], '─'.repeat(rule)));
  // the tagline in the terminal's own text color (readable on dark and light themes), gold for the brand parts
  lines.push('  ' + bold(t.line) + dim('  ·  ') + rgb(STOPS[0], t.by));
  lines.push('  ' + dim(t.second));
  if (e) {
    lines.push('');
    const tag = b.kit ? dim(`  ${b.kit}${b.version ? ' ' + b.version : ''}`) : '';
    lines.push('  ' + plate(` ${e} `) + tag);
  }
  lines.push('');
  return lines.join('\n');
}

// on-screen width: no color codes, Korean / CJK and full-width signs count 2
export const strip = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');
export function width(s) {
  let w = 0;
  for (const ch of strip(s)) { const c = ch.codePointAt(0); w += (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) ? 2 : 1; }
  return w;
}
// cut plain text into lines that fit `w` columns (breaks at spaces when it can)
export function wrap(text, w) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/(?<= )/)) {
      if (width(line + word) <= w) { line += word; continue; }
      if (line.trim()) out.push(line.trimEnd());
      line = word;
      while (width(line) > w) { let cut = ''; for (const ch of line) { if (width(cut + ch) > w) break; cut += ch; } out.push(cut); line = line.slice(cut.length); }
    }
    out.push(line.trimEnd());
  }
  return out;
}
export const white = (t) => (colorOn() ? `\x1b[1;38;2;245;242;235m${t}\x1b[0m` : t);
export const soft = (t) => rgb([242, 180, 90], t);
export const ivory = (t) => rgb(IVORY, t);
export const red = (t) => rgb([255, 112, 102], t);
export const cols = () => Math.max(60, Math.min(process.stdout.columns || +process.env.COLUMNS || 100, 120));
// a paragraph under a label: first line after `first`, the rest indented by `indent` columns, all inside the terminal
export const para = (first, text, indent, paint = (x) => x) => wrap(text, cols() - indent - 2).map((l, i) => (i ? ' '.repeat(indent) : first) + paint(l)).join('\n');
