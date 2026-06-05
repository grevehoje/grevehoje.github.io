import { CPScraper, MetroLisboaScraper, MetroPortoScraper, CarrisScraper, FertagusScraper } from '../server/src/scrapers';
import { writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

async function main() {
  const outPath = join(resolve(__dirname, '..', 'client', 'public', 'data'), 'status.json');
  console.log('Output path:', outPath);
  console.log('CWD:', process.cwd());
  console.log('Script dir:', __dirname);

  const scrapers = [new CPScraper(), new MetroLisboaScraper(), new MetroPortoScraper(), new CarrisScraper(), new FertagusScraper()];
  const results = await Promise.all(scrapers.map(s => s.scrape()));
  const hasStrikes = results.some(op => op.status === 'red');
  const lastUpdate = new Date().toISOString();

  const data = { hasStrikes, lastUpdate, operators: results };
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  const { statSync } = require('fs');
  console.log(`Written ${outPath}, ${statSync(outPath).size} bytes`);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
