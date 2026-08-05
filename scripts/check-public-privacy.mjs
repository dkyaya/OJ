import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const forbiddenRoots = ['Trade Ideas','Active Trades','Closed Trades','Journal','Research','Templates','Catalysts','Attachments'];
const failures = forbiddenRoots.filter((name) => fs.existsSync(path.join(root, name))).map((name) => `${name}: private canonical directory exists in public repository`);
const dataDir = path.join(root,'app/public/data');
for (const fixture of ['trades.json','catalysts.json']) {
  const parsed = JSON.parse(fs.readFileSync(path.join(dataDir,fixture),'utf8'));
  if (!Array.isArray(parsed) || parsed.length) failures.push(`${fixture}: production public fixture must be an empty array`);
}
const files = [];
const scan = (dir) => { if (!fs.existsSync(dir)) return; for (const item of fs.readdirSync(dir,{withFileTypes:true})) { const full=path.join(dir,item.name); item.isDirectory()?scan(full):files.push(full); } };
scan(path.join(root,'app/dist'));
scan(path.join(root,'app/public'));
const credential = /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const privateData = /(formalization_job_id:|payload_hash:\s*["']?[0-9a-f]{64}|actual_entry:|## Emotional discipline|routing number|account number)/i;
for (const file of files) {
  if (file.endsWith('.png') || file.endsWith('.ico')) continue;
  const text=fs.readFileSync(file,'utf8');
  if (credential.test(text)) failures.push(`${path.relative(root,file)}: credential material in public artifact`);
  if (privateData.test(text)) failures.push(`${path.relative(root,file)}: canonical/private journal marker in public artifact`);
}
const sw = fs.readFileSync(path.join(root,'app/public/sw.js'),'utf8');
if (/supabase|\/rest\/v1|\/auth\/v1|\/functions\/v1/i.test(sw)) failures.push('service worker references authenticated backend traffic');
if (fs.readdirSync(path.join(root,'app'),{withFileTypes:true}).some((entry)=>entry.name.startsWith('.env')&&entry.name!=='.env.example')) failures.push('unexpected .env file under app');
if (failures.length) throw new Error(failures.join('\n'));
