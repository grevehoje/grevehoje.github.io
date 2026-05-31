export type OperatorStatus = 'red' | 'green' | 'yellow';

export interface StrikeEvent {
  startDate: string;
  endDate?: string;
  isConfirmed: boolean;
  description: string;
  sourceUrl?: string;
}

export interface StrikeInfo {
  operator: string;
  status: OperatorStatus;
  message: string;
  details?: string;
  lastChecked: string;
  sourceUrl?: string;
  upcomingEvents: StrikeEvent[];
}

export interface Scraper {
  name: string;
  scrape(): Promise<StrikeInfo>;
}
