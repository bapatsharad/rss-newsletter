import fs from 'fs';
import path from 'path';
import { FeedItem, NewsletterConfig, GenerationStats, FetchResult } from './types.js';

export class NewsletterGenerator {
  private config: NewsletterConfig;
  private outputDir: string;

  constructor(config: NewsletterConfig, outputDir: string = './output') {
    this.config = config;
    this.outputDir = outputDir;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private groupByCategory(items: FeedItem[]): Map<string, FeedItem[]> {
    const grouped = new Map<string, FeedItem[]>();

    for (const item of items) {
      const category = item.category || 'Uncategorized';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(item);
    }

    return grouped;
  }

  private generateItemHtml(item: FeedItem): string {
    const pubDate = new Date(item.pubDate);
    const timeAgo = this.getTimeAgo(pubDate);

    return `
      <article class="news-item">
        <h3><a href="${this.escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(item.title)}</a></h3>
        <div class="meta">
          <span class="source">${this.escapeHtml(item.feedName)}</span>
          <span class="separator">|</span>
          <span class="time" title="${pubDate.toISOString()}">${timeAgo}</span>
          ${item.author ? `<span class="separator">|</span><span class="author">${this.escapeHtml(item.author)}</span>` : ''}
        </div>
        ${item.description ? `<p class="description">${this.escapeHtml(item.description)}</p>` : ''}
      </article>
    `;
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  generateHtml(items: FeedItem[], stats: GenerationStats, feedResults: FetchResult[]): string {
    const now = new Date();
    const grouped = this.groupByCategory(items);

    // Sort items within each category by date
    grouped.forEach((categoryItems) => {
      categoryItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    });

    const categorySections = Array.from(grouped.entries())
      .map(([category, categoryItems]) => `
        <section class="category-section">
          <h2 class="category-title">
            <span class="category-icon">${this.getCategoryIcon(category)}</span>
            ${this.escapeHtml(category)}
            <span class="item-count">(${categoryItems.length})</span>
          </h2>
          <div class="items-list">
            ${categoryItems.map(item => this.generateItemHtml(item)).join('\n')}
          </div>
        </section>
      `).join('\n');

    const successfulFeeds = feedResults.filter(r => r.success);
    const failedFeeds = feedResults.filter(r => !r.success);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${this.escapeHtml(this.config.description)}">
  <meta name="author" content="${this.escapeHtml(this.config.author)}">
  <meta name="generator" content="RSS Newsletter Generator">
  <meta property="og:title" content="${this.escapeHtml(this.config.title)} - ${this.formatDate(now)}">
  <meta property="og:description" content="${this.escapeHtml(this.config.description)}">
  <meta property="og:type" content="website">
  <title>${this.escapeHtml(this.config.title)} - ${this.formatDate(now)}</title>
  <style>
    :root {
      --primary-color: #1a73e8;
      --primary-hover: #1557b0;
      --text-color: #202124;
      --text-secondary: #5f6368;
      --background: #f8f9fa;
      --card-background: #ffffff;
      --border-color: #dadce0;
      --success-color: #34a853;
      --error-color: #ea4335;
      --shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
      --shadow-hover: 0 3px 6px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.12);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --primary-color: #8ab4f8;
        --primary-hover: #aecbfa;
        --text-color: #e8eaed;
        --text-secondary: #9aa0a6;
        --background: #202124;
        --card-background: #292a2d;
        --border-color: #5f6368;
        --shadow: 0 1px 3px rgba(0,0,0,0.24), 0 1px 2px rgba(0,0,0,0.48);
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--background);
      color: var(--text-color);
      line-height: 1.6;
      min-height: 100vh;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }

    header {
      text-align: center;
      padding: 40px 20px;
      background: var(--card-background);
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: var(--shadow);
    }

    header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      color: var(--primary-color);
    }

    header .subtitle {
      color: var(--text-secondary);
      font-size: 1.1rem;
      margin-bottom: 15px;
    }

    header .date {
      font-size: 0.95rem;
      color: var(--text-secondary);
    }

    .stats-bar {
      display: flex;
      justify-content: center;
      gap: 30px;
      flex-wrap: wrap;
      padding: 15px;
      background: var(--card-background);
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: var(--shadow);
    }

    .stat-item {
      text-align: center;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--primary-color);
    }

    .stat-label {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .category-section {
      margin-bottom: 35px;
    }

    .category-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.4rem;
      padding: 15px 20px;
      background: var(--card-background);
      border-radius: 8px 8px 0 0;
      border-bottom: 2px solid var(--primary-color);
      box-shadow: var(--shadow);
    }

    .category-icon {
      font-size: 1.3rem;
    }

    .item-count {
      font-size: 0.9rem;
      color: var(--text-secondary);
      font-weight: normal;
    }

    .items-list {
      background: var(--card-background);
      border-radius: 0 0 8px 8px;
      box-shadow: var(--shadow);
    }

    .news-item {
      padding: 20px;
      border-bottom: 1px solid var(--border-color);
      transition: background-color 0.2s;
    }

    .news-item:last-child {
      border-bottom: none;
      border-radius: 0 0 8px 8px;
    }

    .news-item:hover {
      background-color: var(--background);
    }

    .news-item h3 {
      font-size: 1.1rem;
      margin-bottom: 8px;
      line-height: 1.4;
    }

    .news-item h3 a {
      color: var(--text-color);
      text-decoration: none;
      transition: color 0.2s;
    }

    .news-item h3 a:hover {
      color: var(--primary-color);
    }

    .news-item .meta {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-bottom: 10px;
    }

    .news-item .meta .separator {
      margin: 0 8px;
      opacity: 0.5;
    }

    .news-item .source {
      color: var(--primary-color);
      font-weight: 500;
    }

    .news-item .description {
      color: var(--text-secondary);
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .feed-status {
      background: var(--card-background);
      border-radius: 8px;
      padding: 20px;
      margin-top: 30px;
      box-shadow: var(--shadow);
    }

    .feed-status h3 {
      margin-bottom: 15px;
      font-size: 1.1rem;
    }

    .feed-status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
    }

    .feed-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      background: var(--background);
    }

    .feed-badge.success::before {
      content: '✓';
      color: var(--success-color);
    }

    .feed-badge.error::before {
      content: '✗';
      color: var(--error-color);
    }

    footer {
      text-align: center;
      padding: 30px 20px;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    footer a {
      color: var(--primary-color);
      text-decoration: none;
    }

    footer a:hover {
      text-decoration: underline;
    }

    .no-items {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-secondary);
    }

    .no-items h2 {
      font-size: 1.5rem;
      margin-bottom: 10px;
    }

    @media (max-width: 600px) {
      .container {
        padding: 10px;
      }

      header {
        padding: 25px 15px;
      }

      header h1 {
        font-size: 1.8rem;
      }

      .stats-bar {
        gap: 15px;
      }

      .category-title {
        font-size: 1.2rem;
        padding: 12px 15px;
      }

      .news-item {
        padding: 15px;
      }

      .news-item h3 {
        font-size: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${this.escapeHtml(this.config.title)}</h1>
      <p class="subtitle">${this.escapeHtml(this.config.description)}</p>
      <p class="date">
        <strong>${this.formatDate(now)}</strong> at ${this.formatTime(now)}
      </p>
    </header>

    <div class="stats-bar">
      <div class="stat-item">
        <div class="stat-value">${stats.newItems}</div>
        <div class="stat-label">New Articles</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${stats.successfulFeeds}/${stats.totalFeeds}</div>
        <div class="stat-label">Feeds Processed</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${stats.duplicatesRemoved}</div>
        <div class="stat-label">Duplicates Skipped</div>
      </div>
    </div>

    <main>
      ${items.length > 0 ? categorySections : `
        <div class="no-items">
          <h2>No new articles today</h2>
          <p>All articles from your feeds have already been processed.</p>
        </div>
      `}
    </main>

    <div class="feed-status">
      <h3>Feed Status</h3>
      <div class="feed-status-grid">
        ${feedResults.map(r => `
          <span class="feed-badge ${r.success ? 'success' : 'error'}" title="${r.error || 'OK'}">
            ${this.escapeHtml(r.feedName)}
          </span>
        `).join('')}
      </div>
    </div>

    <footer>
      <p>Generated by <strong>RSS Newsletter Generator</strong></p>
      <p>Last updated: ${now.toISOString()}</p>
    </footer>
  </div>
</body>
</html>`;
  }

  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Tech News': '📰',
      'Technology': '💻',
      'Development': '🛠️',
      'Web Development': '🌐',
      'AI & Machine Learning': '🤖',
      'Cloud & DevOps': '☁️',
      'Security': '🔒',
      'Business': '📊',
      'Science': '🔬',
      'Gaming': '🎮',
      'Uncategorized': '📌'
    };
    return icons[category] || '📌';
  }

  generateArchiveIndex(archives: { date: string; filename: string; itemCount: number }[]): string {
    const now = new Date();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(this.config.title)} - Archive</title>
  <style>
    :root {
      --primary-color: #1a73e8;
      --text-color: #202124;
      --text-secondary: #5f6368;
      --background: #f8f9fa;
      --card-background: #ffffff;
      --border-color: #dadce0;
      --shadow: 0 1px 3px rgba(0,0,0,0.12);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --primary-color: #8ab4f8;
        --text-color: #e8eaed;
        --text-secondary: #9aa0a6;
        --background: #202124;
        --card-background: #292a2d;
        --border-color: #5f6368;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--background);
      color: var(--text-color);
      line-height: 1.6;
      padding: 20px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      color: var(--primary-color);
      margin-bottom: 30px;
    }

    .archive-list {
      list-style: none;
      padding: 0;
    }

    .archive-item {
      background: var(--card-background);
      padding: 15px 20px;
      margin-bottom: 10px;
      border-radius: 8px;
      box-shadow: var(--shadow);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .archive-item a {
      color: var(--primary-color);
      text-decoration: none;
      font-weight: 500;
    }

    .archive-item a:hover {
      text-decoration: underline;
    }

    .archive-item .count {
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    .back-link {
      display: inline-block;
      margin-bottom: 20px;
      color: var(--primary-color);
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="index.html" class="back-link">← Back to Latest</a>
    <h1>Newsletter Archive</h1>
    <ul class="archive-list">
      ${archives.map(a => `
        <li class="archive-item">
          <a href="${a.filename}">${a.date}</a>
          <span class="count">${a.itemCount} articles</span>
        </li>
      `).join('')}
    </ul>
  </div>
</body>
</html>`;
  }

  async writeNewsletter(
    items: FeedItem[],
    stats: GenerationStats,
    feedResults: FetchResult[]
  ): Promise<string> {
    const html = this.generateHtml(items, stats, feedResults);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Write main index.html
    const indexPath = path.join(this.outputDir, 'index.html');
    fs.writeFileSync(indexPath, html, 'utf-8');
    console.log(`\nNewsletter written to: ${indexPath}`);

    // Write dated archive copy
    const archivePath = path.join(this.outputDir, `newsletter-${dateStr}.html`);
    fs.writeFileSync(archivePath, html, 'utf-8');
    console.log(`Archive copy written to: ${archivePath}`);

    // Update archive index
    this.updateArchiveIndex();

    return indexPath;
  }

  private updateArchiveIndex(): void {
    const files = fs.readdirSync(this.outputDir)
      .filter(f => f.startsWith('newsletter-') && f.endsWith('.html'))
      .sort()
      .reverse();

    const archives = files.map(f => {
      const dateMatch = f.match(/newsletter-(\d{4}-\d{2}-\d{2})\.html/);
      const date = dateMatch ? dateMatch[1] : f;
      const content = fs.readFileSync(path.join(this.outputDir, f), 'utf-8');
      const itemCount = (content.match(/<article class="news-item">/g) || []).length;
      return { date, filename: f, itemCount };
    });

    const archiveHtml = this.generateArchiveIndex(archives);
    fs.writeFileSync(path.join(this.outputDir, 'archive.html'), archiveHtml, 'utf-8');
  }
}
