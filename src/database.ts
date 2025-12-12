import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ProcessedItem } from './types.js';

export class DatabaseManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = './data/processed.db') {
    this.dbPath = dbPath;

    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    // Create processed items table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed_items (
        url TEXT PRIMARY KEY,
        feed_name TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        title TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_processed_at
      ON processed_items(processed_at)
    `);

    // Create feed stats table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feed_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_name TEXT NOT NULL,
        fetch_date TEXT NOT NULL,
        items_fetched INTEGER DEFAULT 0,
        items_new INTEGER DEFAULT 0,
        success INTEGER DEFAULT 1,
        error_message TEXT
      )
    `);

    // Create generation history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        generated_at TEXT NOT NULL,
        total_feeds INTEGER,
        successful_feeds INTEGER,
        failed_feeds INTEGER,
        new_items INTEGER,
        duplicates_removed INTEGER
      )
    `);

    console.log('Database initialized successfully');
  }

  isProcessed(url: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM processed_items WHERE url = ?');
    const result = stmt.get(url);
    return !!result;
  }

  markAsProcessed(url: string, feedName: string, title?: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO processed_items (url, feed_name, processed_at, title)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(url, feedName, new Date().toISOString(), title || null);
  }

  markMultipleAsProcessed(items: { url: string; feedName: string; title?: string }[]): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO processed_items (url, feed_name, processed_at, title)
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: { url: string; feedName: string; title?: string }[]) => {
      const now = new Date().toISOString();
      for (const item of items) {
        stmt.run(item.url, item.feedName, now, item.title || null);
      }
    });

    insertMany(items);
  }

  getProcessedUrls(): Set<string> {
    const stmt = this.db.prepare('SELECT url FROM processed_items');
    const rows = stmt.all() as { url: string }[];
    return new Set(rows.map(r => r.url));
  }

  getProcessedCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM processed_items');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  cleanOldEntries(retentionDays: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const stmt = this.db.prepare(`
      DELETE FROM processed_items
      WHERE processed_at < ?
    `);
    const result = stmt.run(cutoffDate.toISOString());

    if (result.changes > 0) {
      console.log(`Cleaned ${result.changes} old entries (older than ${retentionDays} days)`);
    }

    return result.changes;
  }

  recordFeedStats(
    feedName: string,
    itemsFetched: number,
    itemsNew: number,
    success: boolean,
    errorMessage?: string
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO feed_stats (feed_name, fetch_date, items_fetched, items_new, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      feedName,
      new Date().toISOString(),
      itemsFetched,
      itemsNew,
      success ? 1 : 0,
      errorMessage || null
    );
  }

  recordGeneration(stats: {
    totalFeeds: number;
    successfulFeeds: number;
    failedFeeds: number;
    newItems: number;
    duplicatesRemoved: number;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO generation_history
      (generated_at, total_feeds, successful_feeds, failed_feeds, new_items, duplicates_removed)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      new Date().toISOString(),
      stats.totalFeeds,
      stats.successfulFeeds,
      stats.failedFeeds,
      stats.newItems,
      stats.duplicatesRemoved
    );
  }

  getRecentGenerations(limit: number = 10): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM generation_history
      ORDER BY generated_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  close(): void {
    this.db.close();
    console.log('Database connection closed');
  }
}
