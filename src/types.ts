export interface FeedConfig {
  name: string;
  url: string;
  category: string;
  enabled: boolean;
}

export interface NewsletterConfig {
  title: string;
  description: string;
  author: string;
  maxItemsPerFeed: number;
  maxTotalItems: number;
  retentionDays: number;
}

export interface Config {
  newsletter: NewsletterConfig;
  feeds: FeedConfig[];
  categories: string[];
}

export interface FeedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  feedName: string;
  category: string;
  author?: string;
}

export interface ProcessedItem {
  url: string;
  processedAt: string;
  feedName: string;
}

export interface FetchResult {
  feedName: string;
  success: boolean;
  items: FeedItem[];
  error?: string;
}

export interface GenerationStats {
  totalFeeds: number;
  successfulFeeds: number;
  failedFeeds: number;
  newItems: number;
  duplicatesRemoved: number;
  generatedAt: Date;
}
