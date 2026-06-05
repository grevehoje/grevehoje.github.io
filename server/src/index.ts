import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { CPScraper, MetroLisboaScraper, MetroPortoScraper, CarrisScraper, FertagusScraper } from './scrapers';
import { StrikeInfo } from './types';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

const scrapers = [new CPScraper(), new MetroLisboaScraper(), new MetroPortoScraper(), new CarrisScraper(), new FertagusScraper()];
let cache: StrikeInfo[] = [];
let lastGlobalUpdate = '';

async function updateData() {
  console.log('Updating strike data...');
  const results = await Promise.all(scrapers.map(s => s.scrape()));
  cache = results;
  lastGlobalUpdate = new Date().toISOString();
}

// Initial update
let initialUpdate = updateData();
// Update every 15 minutes
setInterval(updateData, 15 * 60 * 1000);

app.get('/api/status', (req: Request, res: Response) => {
  // Only count as "has strikes TODAY" if status is red — yellow means upcoming only
  const hasStrikes = cache.some(op => op.status === 'red');
  res.json({
    hasStrikes,
    lastUpdate: lastGlobalUpdate,
    operators: cache
  });
});

initialUpdate.then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
});
