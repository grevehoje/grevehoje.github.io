import axios from 'axios';
import * as cheerio from 'cheerio';
import { Scraper, StrikeInfo, StrikeEvent } from './types';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const months: { [key: string]: number } = {
  janeiro: 0, fevereiro: 1, março: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
};

function parsePortugueseDate(text: string, fallback: string): string {
  const regex = /(\d+)\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?/i;
  const match = text.match(regex);
  if (match && match[1] && match[2]) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const month = months[monthStr];
    if (month !== undefined) {
      const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
      const date = new Date(year, month, day, 12, 0, 0);
      return date.toISOString();
    }
  }
  return fallback;
}

export class CPScraper implements Scraper {
  name = 'CP - Comboios de Portugal';
  url = 'https://www.cp.pt/pt/passageiros/consultar-horarios/avisos';

  async scrape(): Promise<StrikeInfo> {
    try {
      const apiUrl = 'https://www.cp.pt/bei/getContentsList?path=PWA/Homepage/Avisos&itensPage=-1&order=priority:desc';
      const { data } = await axios.get(apiUrl, {
        headers: { 
          'User-Agent': USER_AGENT,
          'Referer': this.url,
          'Origin': 'https://www.cp.pt'
        }
      });

      const items = data?.item || [];
      let upcomingEvents: StrikeEvent[] = [];
      let hasStrike = false;

      // Helper function to extract field data
      const getFieldValue = (fields: any[], name: string): string | null => {
        const f = fields.find((field: any) => field.name === name);
        return f && f.contentFieldValue ? String(f.contentFieldValue.data) : null;
      };

      // Filter active warnings using the same logic as the CP website
      const activeWarnings = items.filter((item: any) => {
        const fields = item.contentFields && item.contentFields['pt-PT'];
        if (!fields || !Array.isArray(fields)) return false;
        const checkbox = fields.find((f: any) => f.name === 'Checkbox33013581');
        const val = checkbox && checkbox.contentFieldValue ? checkbox.contentFieldValue.data : null;
        return val === 'true' || val === true;
      });

      const strikeKeywords = ['greve', 'paralisação', 'serviços mínimos', 'supressões', 'suprimidos', 'perturbação', 'perturbações'];

      for (const item of activeWarnings) {
        const fields = item.contentFields['pt-PT'];
        const title = getFieldValue(fields, 'Text48691729') || '';
        const description = getFieldValue(fields, 'Campo69402820') || '';
        const titleLower = title.toLowerCase();
        const descLower = description.toLowerCase();

        // Check if this notice is about a strike
        const isStrikeNotice = strikeKeywords.some(kw => titleLower.includes(kw) || descLower.includes(kw));

        if (isStrikeNotice) {
          hasStrike = true;
          
          // Try to extract start date from the title, default to published date
          const datePublished = item.datePublished || new Date().toISOString();
          const startDate = parsePortugueseDate(title, datePublished);
          
          // Build direct warning link
          const detailUrl = item.friendlyUrlPath 
            ? `https://www.cp.pt/pt/detalhe-aviso/${item.friendlyUrlPath}`
            : this.url;

          upcomingEvents.push({
            startDate,
            isConfirmed: true,
            description: title,
            sourceUrl: detailUrl
          });
        }
      }

      // Filter out past events
      const yesterdayEnd = new Date(); yesterdayEnd.setDate(yesterdayEnd.getDate() - 1); yesterdayEnd.setHours(23, 59, 59, 999);
      upcomingEvents = upcomingEvents.filter(e => new Date(e.startDate).getTime() > yesterdayEnd.getTime());

      // Sort upcoming events chronologically
      upcomingEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      // Determine if any strike is happening TODAY vs just in the future
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const strikeToday = upcomingEvents.some(e => {
        const d = new Date(e.startDate);
        return d >= todayStart && d <= todayEnd;
      });

      const status = !hasStrike ? 'green' : strikeToday ? 'red' : 'yellow';

      const formatDatePT = (iso: string) =>
        new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });

      const firstEvent = upcomingEvents[0];

      const message = !hasStrike || !firstEvent
        ? 'Circulação normal.'
        : strikeToday
          ? 'Greve em curso hoje'
          : `Greve prevista - ${formatDatePT(firstEvent.startDate)}`;

      return {
        operator: this.name,
        status,
        message,
        lastChecked: new Date().toISOString(),
        ...(hasStrike && upcomingEvents[0]?.sourceUrl ? { sourceUrl: upcomingEvents[0].sourceUrl } : {}),
        upcomingEvents
      };
    } catch (error) {
      console.error(`Error scraping CP:`, error);
      return {
        operator: this.name,
        status: 'yellow',
        message: 'Não foi possível obter dados oficiais.',
        lastChecked: new Date().toISOString(),
        upcomingEvents: []
      };
    }
  }
}

export class MetroPortoScraper implements Scraper {
  name = 'Metro do Porto';
  url = 'https://www.metrodoporto.pt/pages/1';

  async scrape(): Promise<StrikeInfo> {
    try {
      const { data } = await axios.get(this.url, {
        headers: { 'User-Agent': USER_AGENT }
      });
      const $ = cheerio.load(data);

      const lines = $('#links_list_20 ul li');
      let hasProblem = false;
      const issues: string[] = [];

      lines.each((_, el) => {
        const lineName = $(el).find('.title h4').text().trim();
        const statusText = $(el).find('.text .writer_text p').text().trim().toLowerCase();
        if (statusText !== 'ok') {
          hasProblem = true;
          issues.push(`${lineName}: ${statusText}`);
        }
      });

      if (!hasProblem) {
        return {
          operator: this.name,
          status: 'green',
          message: 'Circulação normal.',
          lastChecked: new Date().toISOString(),
          upcomingEvents: []
        };
      }

      const combined = issues.join('; ');
      const strikeKeywords = ['greve', 'paralisação', 'serviços mínimos'];
      const isStrike = strikeKeywords.some(kw => combined.toLowerCase().includes(kw));

      return {
        operator: this.name,
        status: isStrike ? 'red' : 'yellow',
        message: isStrike ? 'Greve detectada.' : `Perturbações: ${combined}`,
        lastChecked: new Date().toISOString(),
        sourceUrl: this.url,
        upcomingEvents: isStrike
          ? [{ startDate: new Date().toISOString(), isConfirmed: true, description: combined, sourceUrl: this.url }]
          : []
      };
    } catch (error) {
      console.error(`Error scraping Metro Porto:`, error);
      return {
        operator: this.name,
        status: 'yellow',
        message: 'Não foi possível obter dados oficiais.',
        lastChecked: new Date().toISOString(),
        upcomingEvents: []
      };
    }
  }
}

export class CarrisScraper implements Scraper {
  name = 'Carris';
  url = 'https://www.carris.pt/viaje/alteracoes-de-servico/';

  async scrape(): Promise<StrikeInfo> {
    try {
      const { data } = await axios.get(this.url, {
        headers: { 'User-Agent': USER_AGENT }
      });
      const $ = cheerio.load(data);

      const strikeKeywords = ['greve', 'paralisação', 'serviços mínimos'];
      let upcomingEvents: StrikeEvent[] = [];
      let hasStrike = false;

      $('a.results-container').each((_, el) => {
        const titleEl = $(el).find('.title');
        const description = titleEl.text().trim();
        const dateText = $(el).find('.start-date').text().trim();
        const href = $(el).attr('href') || '';
        const descriptionLower = description.toLowerCase();

        const isStrikeNotice = strikeKeywords.some(kw => descriptionLower.includes(kw));

        if (isStrikeNotice) {
          hasStrike = true;
          const parts = dateText.split('.');
          let startDate = new Date().toISOString();
          if (parts.length === 3) {
            const d = new Date(+(parts[2] as string), +(parts[1] as string) - 1, +(parts[0] as string), 12, 0, 0);
            startDate = d.toISOString();
          }

          upcomingEvents.push({
            startDate,
            isConfirmed: true,
            description,
            sourceUrl: href.startsWith('http') ? href : `https://www.carris.pt${href}`
          });
        }
      });

      const yesterdayEnd = new Date(); yesterdayEnd.setDate(yesterdayEnd.getDate() - 1); yesterdayEnd.setHours(23, 59, 59, 999);
      upcomingEvents = upcomingEvents.filter(e => new Date(e.startDate).getTime() > yesterdayEnd.getTime());

      upcomingEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const strikeToday = upcomingEvents.some(e => {
        const d = new Date(e.startDate);
        return d >= todayStart && d <= todayEnd;
      });

      const status = !hasStrike ? 'green' : strikeToday ? 'red' : 'yellow';

      const formatDatePT = (iso: string) =>
        new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });

      const firstEvent = upcomingEvents[0];
      const message = !hasStrike || !firstEvent
        ? 'Circulação normal.'
        : strikeToday
          ? 'Greve em curso hoje'
          : `Greve prevista - ${formatDatePT(firstEvent.startDate)}`;

      return {
        operator: this.name,
        status,
        message,
        lastChecked: new Date().toISOString(),
        ...(hasStrike && upcomingEvents[0]?.sourceUrl ? { sourceUrl: upcomingEvents[0].sourceUrl } : {}),
        upcomingEvents
      };
    } catch (error) {
      console.error(`Error scraping Carris:`, error);
      return {
        operator: this.name,
        status: 'yellow',
        message: 'Não foi possível obter dados oficiais.',
        lastChecked: new Date().toISOString(),
        upcomingEvents: []
      };
    }
  }
}

export class FertagusScraper implements Scraper {
  name = 'Fertagus';
  url = 'https://www.fertagus.pt/Fertagus-pt/Viajar/Comunicados-e-Campanhas';
  apiUrl = 'https://www.fertagus.pt/DesktopModules/FTWebsite_BaseService/API/Tabs/GetPagedTabsToNavigation';

  async scrape(): Promise<StrikeInfo> {
    try {
      const { data } = await axios.get(this.apiUrl, {
        params: {
          PortalId: 0,
          ParentId: 103,
          ModuleId: 1005,
          pageNo: 1,
          pageSize: 20,
          Culture: 'pt-PT'
        },
        headers: {
          'User-Agent': USER_AGENT,
          'ModuleId': '1005',
          'TabId': '103',
          'Referer': this.url
        }
      });

      const items = data?.Dados || [];
      const strikeKeywords = ['greve', 'paralisação', 'serviços mínimos', 'supressões', 'suprimidos'];
      let upcomingEvents: StrikeEvent[] = [];
      let hasStrike = false;

      for (const item of items) {
        const title = item.Title || '';
        const descHtml = item.Description || '';
        const indentedName = item.IndentedTabName || '';
        const plainDescription = descHtml.replace(/<[^>]+>/g, '').trim();
        const displayText = title || indentedName || plainDescription;
        const combined = `${title} ${indentedName} ${plainDescription}`.toLowerCase();
        const isStrikeNotice = strikeKeywords.some(kw => combined.includes(kw));

        if (isStrikeNotice) {
          hasStrike = true;
          const startDate = parsePortugueseDate(displayText, new Date().toISOString());

          upcomingEvents.push({
            startDate,
            isConfirmed: true,
            description: displayText,
            sourceUrl: item.TabUrl
              ? (item.TabUrl.startsWith('http') ? item.TabUrl : `https://www.fertagus.pt${item.TabUrl}`)
              : this.url
          });
        }
      }

      const yesterdayEnd = new Date(); yesterdayEnd.setDate(yesterdayEnd.getDate() - 1); yesterdayEnd.setHours(23, 59, 59, 999);
      upcomingEvents = upcomingEvents.filter(e => new Date(e.startDate).getTime() > yesterdayEnd.getTime());

      upcomingEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const strikeToday = upcomingEvents.some(e => {
        const d = new Date(e.startDate);
        return d >= todayStart && d <= todayEnd;
      });

      const status = !hasStrike ? 'green' : strikeToday ? 'red' : 'yellow';

      const formatDatePT = (iso: string) =>
        new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });

      const firstEvent = upcomingEvents[0];
      const message = !hasStrike || !firstEvent
        ? 'Circulação normal.'
        : strikeToday
          ? 'Greve em curso hoje'
          : `Greve prevista - ${formatDatePT(firstEvent.startDate)}`;

      return {
        operator: this.name,
        status,
        message,
        lastChecked: new Date().toISOString(),
        ...(hasStrike && upcomingEvents[0]?.sourceUrl ? { sourceUrl: upcomingEvents[0].sourceUrl } : {}),
        upcomingEvents
      };
    } catch (error) {
      console.error(`Error scraping Fertagus:`, error);
      return {
        operator: this.name,
        status: 'yellow',
        message: 'Não foi possível obter dados oficiais.',
        lastChecked: new Date().toISOString(),
        upcomingEvents: []
      };
    }
  }
}

export class MetroLisboaScraper implements Scraper {
  name = 'Metro de Lisboa';
  url = 'https://www.metrolisboa.pt/informar/noticias/';
  ajaxUrl = 'https://www.metrolisboa.pt/wp-admin/admin-ajax.php?action=estado_linha_ajax_2022_nova_action';

  async scrape(): Promise<StrikeInfo> {
    try {
      const { data } = await axios.get(this.ajaxUrl, {
        headers: { 'User-Agent': USER_AGENT }
      });
      const $ = cheerio.load(data);

      const lines = [
        { id: 'statusAmarela',  name: 'Linha Amarela' },
        { id: 'statusAzul',     name: 'Linha Azul' },
        { id: 'statusVerde',    name: 'Linha Verde' },
        { id: 'statusVermelha', name: 'Linha Vermelha' },
      ];

      const problems: string[] = [];
      for (const line of lines) {
        const el = $(`#${line.id}`);
        if (el.length) {
          const text = el.find('div').first().text().trim().toLowerCase();
          if (text !== 'normal') {
            problems.push(`${line.name}: ${text}`);
          }
        }
      }

      if (problems.length === 0) {
        return {
          operator: this.name,
          status: 'green',
          message: 'Circulação normal.',
          lastChecked: new Date().toISOString(),
          upcomingEvents: []
        };
      }

      const combined = problems.join('; ');
      return {
        operator: this.name,
        status: 'yellow',
        message: `Perturbações: ${combined}`,
        lastChecked: new Date().toISOString(),
        sourceUrl: this.url,
        upcomingEvents: []
      };
    } catch (error) {
      console.error(`Error scraping Metro Lisboa:`, error);
      return {
        operator: this.name,
        status: 'yellow',
        message: 'Não foi possível obter dados oficiais.',
        lastChecked: new Date().toISOString(),
        upcomingEvents: []
      };
    }
  }
}
