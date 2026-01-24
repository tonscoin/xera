#!/usr/bin/env node
/**
 * Scan /cardimg and generate proof.json sorted by latest commit time (desc).
 * Supported extensions: jpg, jpeg, png, webp, gif, avif
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CARD_DIR = 'cardimg';
const OUT_FILE = 'proof.json';
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

function gitCommitTime(filePath) {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${filePath}"`, { encoding: 'utf8' }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function listCardImages() {
  if (!fs.existsSync(CARD_DIR)) return [];
  const files = fs.readdirSync(CARD_DIR, { withFileTypes: true })
    .filter(d => d.isFile())
    .map(d => d.name)
    .filter(name => {
      if (name.startsWith('.')) return false;
      if (name.toLowerCase() === '.keep') return false;
      const ext = path.extname(name).toLowerCase();
      return ALLOWED.has(ext);
    });
  // stable sort by name first (so ties are deterministic)
  files.sort((a, b) => a.localeCompare(b));
  return files;
}

const files = listCardImages();
function pickRegionFromName(base) {
  // 파일명에 지역 키워드가 있으면 매칭 (없으면 기타)
  const lower = base.toLowerCase();
  if (lower.includes('강남')) return '서울/강남';
  if (lower.includes('홍대')) return '서울/홍대';
  if (lower.includes('명동')) return '서울/명동';
  if (lower.includes('부산')) return '부산';
  if (lower.includes('제주')) return '제주';
  return '기타';
}

function parseTitleFromName(base) {
  // 예: 2026-01-24_강남_파리바게뜨 -> '강남 파리바게뜨'
  let s = base;
  // 앞부분 날짜 제거
  s = s.replace(/^\d{4}-\d{2}-\d{2}[_\- ]?/, '');
  s = s.replace(/^\d{8}[_\- ]?/, '');
  s = s.replace(/[_\-]+/g, ' ').trim();
  return s || base;
}

function dateFromTs(ts) {
  // ISO8601 -> YYYY-MM-DD
  return (ts || '').slice(0, 10);
}

const items = files.map((name) => {
  const rel = path.posix.join(CARD_DIR, name);
  const ts = gitCommitTime(rel) || new Date().toISOString();
  const base = name.replace(path.extname(name), '');
  return {
    type: 'image',
    file: name,
    path: rel,
    ext: path.extname(name).replace('.', '').toLowerCase(),
    ts,                          // ISO8601 (commit time)
    date: dateFromTs(ts),        // YYYY-MM-DD
    category: '실사용',
    region: pickRegionFromName(base),
    title: parseTitleFromName(base)
  };
});

items.sort((a, b) => {
  // desc by ts, then by file
  if (a.ts === b.ts) return a.file.localeCompare(b.file);
  return a.ts < b.ts ? 1 : -1;
});

const payload = {
  version: 1,
  generated_at: new Date().toISOString(),
  count: items.length,
  items
};

fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`Wrote ${OUT_FILE} with ${items.length} item(s).`);
