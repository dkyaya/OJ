import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

async function main() {
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tradeSchema = z.object({ id:z.string(), ticker:z.string(), strategy:z.string(), status:z.enum(['watchlist','ready','active','closed','rejected']), bias:z.string(), confidence:z.string(), plannedEntry:z.string(), plannedExitBefore:z.string(), expiration:z.string(), catalysts:z.array(z.string()), candidates:z.array(z.object({name:z.string(),width:z.string(),debit:z.string(),risk:z.string(),summary:z.string()})), fields:z.record(z.string(), z.string()) });
const scalar = (value:string) => value.trim().replace(/^['\"]|['\"]$/g, '');
function parseFrontmatter(text:string) { const block=text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''; const d:Record<string,string|string[]>={}; let key=''; for(const line of block.split('\n')) { const item=line.match(/^\s+-\s+(.+)/); if(item&&key&&Array.isArray(d[key])) { d[key].push(scalar(item[1])); continue; } const field=line.match(/^([\w_]+):\s*(.*)$/); if(field){key=field[1];d[key]=field[2]?scalar(field[2]):[];} } return d; }
const dirs=[['Trade Ideas','watchlist'],['Active Trades','active'],['Closed Trades','closed']] as const;
const trades=[];
for(const [dir, fallback] of dirs){ for(const file of await readdir(path.join(root,dir))){ if(!file.endsWith('.md')) continue; const raw=await readFile(path.join(root,dir,file),'utf8'); const fm=parseFrontmatter(raw); if(!fm.ticker) continue; const fields=Object.fromEntries(Object.entries(fm).filter(([,v])=>typeof v==='string')) as Record<string,string>; const trade={id:fields.id||file.replace('.md',''),ticker:fields.ticker,strategy:fields.strategy||'TBD',status:(fields.status||fallback) as 'watchlist',bias:fields.bias||'TBD',confidence:fields.confidence||'TBD',plannedEntry:fields.planned_entry||'TBD',plannedExitBefore:fields.planned_exit_before||'TBD',expiration:fields.expiration||'TBD',catalysts:(fm.catalysts||[]) as string[],candidates:[{name:'Balanced',width:'~$1',debit:'$0.40–$0.50',risk:'$40–$50',summary:'Near-the-money; lower required move.'},{name:'Aggressive',width:'~$2',debit:'$0.40–$0.60',risk:'$40–$60',summary:'Moderately out-of-the-money; higher required move.'}],fields}; trades.push(tradeSchema.parse(trade)); } }
const account={totalCapital:1200,optionsAllocation:200,normalLoss:[40,50],absoluteLoss:60,maxSpreads:1,availableOptionsCapital:200,capitalAtRisk:0,realizedPnl:null,unrealizedPnl:null};
const catalysts=trades.flatMap(t=>t.catalysts.map(entry=>{const [date,event,sensitivity,hold]=entry.split('|').map(s=>s.trim());return {date,event,sensitivity,holdThrough:hold,ticker:t.ticker,tradeId:t.id};}));
const out=path.join(root,'app/public/data'); await mkdir(out,{recursive:true});
await Promise.all([writeFile(path.join(out,'trades.json'),JSON.stringify(trades,null,2)),writeFile(path.join(out,'catalysts.json'),JSON.stringify(catalysts,null,2)),writeFile(path.join(out,'account-summary.json'),JSON.stringify(account,null,2)),writeFile(path.join(out,'analytics.json'),JSON.stringify({totalPnl:null,winRate:null,ruleAdherence:null,processScore:null},null,2)),writeFile(path.join(out,'build-metadata.json'),JSON.stringify({generatedAt:new Date().toISOString(),source:'Sanitized Obsidian Markdown',version:'0.1.0'},null,2))]);
console.log(`Generated sanitized data for ${trades.length} trade idea(s).`);
}
void main();
