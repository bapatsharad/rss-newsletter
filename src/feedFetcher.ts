import Parser from 'rss-parser';
import crypto from 'crypto';
import { FeedConfig, FeedItem, FetchResult } from './types.js';

export class FeedFetcher {
  private parser: Parser;
  private timeout: number;

  constructor(timeout: number = 30000) {
    this.parser = new Parser({
      timeout: timeout,
      headers: {
        'User-Agent': 'RSS-Newsletter-Bot/1.0 (GitHub Actions)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      customFields: {
        item: ['media:content', 'content:encoded', 'dc:creator']
      }
    });
    this.timeout = timeout;
  }

  private generateItemId(item: Parser.Item, feedName: string): string {
    const uniqueString = item.guid || item.link || `${feedName}-${item.title}-${item.pubDate}`;
    return crypto.createHash('md5').update(uniqueString).digest('hex');
  }

  private sanitizeHtml(html: string | undefined): string {
    if (!html) return '';

    // Remove HTML tags but keep text content
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    // Limit description length
    if (text.length > 300) {
      text = text.substring(0, 297) + '...';
    }

    return text;
  }

  async fetchFeed(feedConfig: FeedConfig): Promise<FetchResult> {
    const { name, url, category } = feedConfig;

    try {
      console.log(`Fetching feed: ${name} (${url})`);

      const feed = await this.parser.parseURL(url);
      const items: FeedItem[] = [];

      for (const item of feed.items) {
        if (!item.link) continue;

        const feedItem: FeedItem = {
          id: this.generateItemId(item, name),
          title: item.title || 'Untitled',
          link: item.link,
          description: this.sanitizeHtml(item.contentSnippet || item.content || item.summary),
          pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          feedName: name,
          category: category,
          author: item.creator || item.author || feed.title
        };

        items.push(feedItem);
      }

      console.log(`  Successfully fetched ${items.length} items from ${name}`);

      return {
        feedName: name,
        success: true,
        items
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`  Failed to fetch ${name}: ${errorMessage}`);

      return {
        feedName: name,
        success: false,
        items: [],
        error: errorMessage
      };
    }
  }

  async fetchAllFeeds(
    feeds: FeedConfig[],
    maxItemsPerFeed: number
  ): Promise<{ results: FetchResult[]; allItems: FeedItem[] }> {
    const enabledFeeds = feeds.filter(f => f.enabled);
    console.log(`\nFetching ${enabledFeeds.length} enabled feeds...\n`);

    const results: FetchResult[] = [];
    const allItems: FeedItem[] = [];

    // Process feeds sequentially to avoid rate limiting
    for (const feed of enabledFeeds) {
      const result = await this.fetchFeed(feed);
      results.push(result);

      if (result.success) {
        // Sort by date and take only the most recent items per feed
        const sortedItems = result.items
          .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
          .slice(0, maxItemsPerFeed);

        allItems.push(...sortedItems);
      }

      // Small delay between requests to be respectful
      await this.delay(500);
    }

    return { results, allItems };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
