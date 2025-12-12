import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Config, FeedItem, GenerationStats } from './types.js';
import { DatabaseManager } from './database.js';
import { FeedFetcher } from './feedFetcher.js';
import { NewsletterGenerator } from './newsletterGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function loadConfig(): Promise<Config> {
  const configPath = path.join(rootDir, 'feeds.config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const configContent = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent) as Config;
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('RSS Newsletter Generator');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  let db: DatabaseManager | null = null;

  try {
    // Load configuration
    const config = await loadConfig();
    console.log(`Loaded configuration: ${config.feeds.length} feeds configured`);
    console.log(`Newsletter: "${config.newsletter.title}"`);
    console.log(`Max items per feed: ${config.newsletter.maxItemsPerFeed}`);
    console.log(`Max total items: ${config.newsletter.maxTotalItems}`);

    // Initialize database
    const dbPath = path.join(rootDir, 'data', 'processed.db');
    db = new DatabaseManager(dbPath);

    // Clean old entries
    db.cleanOldEntries(config.newsletter.retentionDays);

    // Get already processed URLs
    const processedUrls = db.getProcessedUrls();
    console.log(`\nPreviously processed URLs: ${processedUrls.size}`);

    // Fetch all feeds
    const fetcher = new FeedFetcher();
    const { results, allItems } = await fetcher.fetchAllFeeds(
      config.feeds,
      config.newsletter.maxItemsPerFeed
    );

    // Calculate statistics
    const successfulFeeds = results.filter(r => r.success).length;
    const failedFeeds = results.filter(r => !r.success).length;

    console.log(`\n${'─'.repeat(60)}`);
    console.log('Feed Fetch Summary:');
    console.log(`  Total feeds: ${results.length}`);
    console.log(`  Successful: ${successfulFeeds}`);
    console.log(`  Failed: ${failedFeeds}`);
    console.log(`  Total items fetched: ${allItems.length}`);

    // Filter out already processed items
    const newItems = allItems.filter(item => !processedUrls.has(item.link));
    const duplicatesRemoved = allItems.length - newItems.length;

    console.log(`\nDeduplication:`);
    console.log(`  New items: ${newItems.length}`);
    console.log(`  Duplicates removed: ${duplicatesRemoved}`);

    // Sort by date and limit total items
    const sortedItems = newItems
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, config.newsletter.maxTotalItems);

    console.log(`  Items for newsletter: ${sortedItems.length}`);

    // Record feed stats
    for (const result of results) {
      const newForFeed = newItems.filter(i => i.feedName === result.feedName).length;
      db.recordFeedStats(
        result.feedName,
        result.items.length,
        newForFeed,
        result.success,
        result.error
      );
    }

    // Generate newsletter
    const generator = new NewsletterGenerator(
      config.newsletter,
      path.join(rootDir, 'output')
    );

    const stats: GenerationStats = {
      totalFeeds: results.length,
      successfulFeeds,
      failedFeeds,
      newItems: sortedItems.length,
      duplicatesRemoved,
      generatedAt: new Date()
    };

    await generator.writeNewsletter(sortedItems, stats, results);

    // Mark new items as processed
    if (sortedItems.length > 0) {
      db.markMultipleAsProcessed(
        sortedItems.map(item => ({
          url: item.link,
          feedName: item.feedName,
          title: item.title
        }))
      );
      console.log(`\nMarked ${sortedItems.length} items as processed`);
    }

    // Record generation stats
    db.recordGeneration({
      totalFeeds: results.length,
      successfulFeeds,
      failedFeeds,
      newItems: sortedItems.length,
      duplicatesRemoved
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log('Generation Complete!');
    console.log(`${'='.repeat(60)}`);
    console.log(`Output: ${path.join(rootDir, 'output', 'index.html')}`);
    console.log(`Completed at: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run the main function
main();
