import { CPScraper, MetroLisboaScraper, MetroPortoScraper, CarrisScraper, FertagusScraper } from '../server/src/scrapers';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const scrapers = [new CPScraper(), new MetroLisboaScraper(), new MetroPortoScraper(), new CarrisScraper(), new FertagusScraper()];
  const results = await Promise.all(scrapers.map(s => s.scrape()));
  const hasStrikes = results.some(op => op.status === 'red');
  const lastUpdate = new Date().toISOString();

  const data = { hasStrikes, lastUpdate, operators: results };
  const outPath = join(__dirname, '..', 'client', 'public', 'data', 'status.json');
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Written ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
