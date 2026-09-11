#!/usr/bin/env bun
/**
 * Copy the English per-step hint headings from sudojo_app into the bot.
 *
 * Source of truth: the top-level `headings` tree in
 * ../sudojo_app/public/locales/en/hints.json (it mirrors the `hints` tree, one
 * heading per solver step key). Only that tree is copied, to
 * src/i18n/locales/en.headings.json (the i18next `headings` namespace).
 *
 * Usage: bun run sync:hint-headings [path/to/hints.json]
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.resolve(
  process.argv[2] || path.join(root, '..', 'sudojo_app', 'public', 'locales', 'en', 'hints.json')
);
const target = path.join(root, 'src', 'i18n', 'locales', 'en.headings.json');

if (!fs.existsSync(source)) {
  console.error(`[sync-hint-headings] Source not found: ${source}`);
  console.error('Check out sudojo_app next to this repo, or pass a path.');
  process.exit(1);
}

const headings = JSON.parse(fs.readFileSync(source, 'utf8')).headings;
if (!headings || typeof headings !== 'object' || Array.isArray(headings)) {
  console.error(`[sync-hint-headings] No "headings" object in ${source}`);
  process.exit(1);
}

let count = 0;
(function countLeaves(node) {
  for (const value of Object.values(node)) {
    if (typeof value === 'string') count++;
    else if (value && typeof value === 'object') countLeaves(value);
  }
})(headings);

const next = JSON.stringify(headings, null, 2) + '\n';
const prev = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
if (prev === next) {
  console.log(`[sync-hint-headings] Up to date (${count} headings).`);
} else {
  fs.writeFileSync(target, next);
  console.log(`[sync-hint-headings] Wrote ${count} headings to ${path.relative(root, target)}`);
}
