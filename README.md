# RSS Newsletter Generator

An enterprise-grade RSS feed aggregator that generates beautiful newsletters and publishes them to GitHub Pages. Runs automatically via GitHub Actions with SQLite-based deduplication.

## Features

- **Automated Daily Generation**: Runs via GitHub Actions on a schedule (daily at 6 AM UTC)
- **Manual Trigger**: Can be triggered manually via GitHub Actions
- **Deduplication**: SQLite database tracks processed URLs to avoid duplicates across runs
- **Error Resilience**: If one feed fails, the generator continues with the remaining feeds
- **Beautiful Output**: Responsive, dark-mode-supporting HTML newsletter
- **Archive Support**: Maintains dated archives of all newsletters
- **Configurable**: Easy JSON configuration for feeds and settings
- **No API Keys Required**: Works entirely with public RSS feeds

## Quick Start

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd rss-feeds
npm install
```

### 2. Configure Your Feeds

Edit `feeds.config.json` to add your RSS feeds:

```json
{
  "newsletter": {
    "title": "My Daily Digest",
    "description": "Your custom description",
    "author": "Your Name",
    "maxItemsPerFeed": 10,
    "maxTotalItems": 50,
    "retentionDays": 30
  },
  "feeds": [
    {
      "name": "Feed Name",
      "url": "https://example.com/feed.xml",
      "category": "Tech News",
      "enabled": true
    }
  ]
}
```

### 3. Run Locally

```bash
# Build and run
npm run generate

# Or for development
npm run dev
```

### 4. Deploy to GitHub

1. Push to GitHub
2. Go to **Settings > Pages**
3. Set source to **GitHub Actions**
4. The workflow will run automatically

## Configuration

### Newsletter Settings

| Setting | Description |
|---------|-------------|
| `title` | Newsletter title displayed in header |
| `description` | Subtitle/description |
| `author` | Author name |
| `maxItemsPerFeed` | Maximum items to take from each feed |
| `maxTotalItems` | Maximum items in the final newsletter |
| `retentionDays` | Days to keep URLs in the database |

### Feed Settings

| Setting | Description |
|---------|-------------|
| `name` | Display name for the feed |
| `url` | RSS/Atom feed URL |
| `category` | Category for grouping |
| `enabled` | Set to `false` to disable a feed |

## How It Works

1. **Fetch**: Downloads RSS feeds from all enabled sources
2. **Parse**: Extracts title, link, description, date, and author
3. **Deduplicate**: Checks SQLite database for already-processed URLs
4. **Generate**: Creates responsive HTML newsletter grouped by category
5. **Store**: Marks new URLs as processed in the database
6. **Deploy**: Uploads to GitHub Pages

## Project Structure

```
rss-feeds/
├── .github/
│   └── workflows/
│       └── generate-newsletter.yml  # GitHub Actions workflow
├── data/
│   └── processed.db                 # SQLite database (auto-created)
├── output/
│   ├── index.html                   # Latest newsletter
│   ├── archive.html                 # Archive index
│   └── newsletter-YYYY-MM-DD.html   # Daily archives
├── src/
│   ├── index.ts                     # Main entry point
│   ├── types.ts                     # TypeScript types
│   ├── database.ts                  # SQLite operations
│   ├── feedFetcher.ts               # RSS fetching logic
│   └── newsletterGenerator.ts       # HTML generation
├── feeds.config.json                # Your feed configuration
├── package.json
└── tsconfig.json
```

## GitHub Actions

The workflow runs:
- **Daily**: At 6 AM UTC (configurable in the workflow file)
- **On Push**: When `feeds.config.json`, `src/**`, or the workflow changes
- **Manually**: Via "Run workflow" button in GitHub Actions

### Enabling GitHub Pages

1. Go to repository **Settings**
2. Navigate to **Pages** in the sidebar
3. Under "Build and deployment", select **GitHub Actions**
4. The next workflow run will deploy your newsletter

## Troubleshooting

### Feed fails to fetch
- Check if the URL is correct and accessible
- Some feeds may have rate limiting
- The generator continues with other feeds even if one fails

### Database grows too large
- Adjust `retentionDays` in config to clean up older entries
- Old entries are automatically cleaned on each run

### Duplicate items appearing
- Ensure the database file is being committed and cached properly
- Check that `data/processed.db` exists after runs

## License

MIT
