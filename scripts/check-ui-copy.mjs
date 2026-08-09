import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../app/src');
const files = [];
const walk = (directory) => { for (const item of fs.readdirSync(directory, { withFileTypes: true })) { const full = path.join(directory, item.name); item.isDirectory() ? walk(full) : /\.(tsx|ts)$/.test(item.name) && files.push(full); } };
walk(root);
const banned = [/A clearer record of every decision/i,/journey through the market/i,/conviction meets clarity/i,/Explore what could move next/i,/Learn from every outcome/i,/Take control of your strategy/i,/Continue Journey/i,/Unlock Insight/i];
const failures = [];
for (const file of files) { const content = fs.readFileSync(file, 'utf8'); for (const phrase of banned) if (phrase.test(content)) failures.push(`${path.relative(root, file)}: banned authenticated-app phrase ${phrase}`); }
if (failures.length) throw new Error(failures.join('\n'));
