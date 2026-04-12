# OrangeDuck — Smart Bookmarks

**AI-Powered Bookmark Manager & Domain Safety Checker — Chrome Extension**

A Chrome extension that combines intelligent bookmark management with real-time domain safety analysis. Supports multiple AI providers (Claude, OpenAI, Gemini, Grok) and 12 languages.

智能收藏夹 — AI 书签管理 + 域名安全检测 Chrome 扩展，支持多 AI 引擎和 12 种语言。

## Features

- **Domain Safety Check** — Real-time phishing, scam & malware detection powered by multi-source threat intelligence
- **Blockchain Risk Badge** — Inject risk scores on Etherscan, Tronscan, BscScan and 6+ block explorers
- **AI Summary** — Auto-generate summaries via Claude, OpenAI, Gemini, Grok, or custom API
- **Semantic Search** — Search by meaning, not just keywords
- **Page Snapshots** — Save page content (3 levels: text / images / full HTML)
- **Health Check** — Detect dead links with real-time progress; view snapshots of offline pages
- **Smart Deduplication** — Same URL / same domain / similar content detection
- **Auto Classify** — AI-powered folder organization
- **Timeline View** — Browse bookmarks chronologically
- **Tag Manager** — Auto-generated tags with merge & rename
- **Cloud Backup** — End-to-end encrypted sync (requires backend API)
- **Import / Export** — Chrome bookmarks, HTML, JSON
- **Multi-language** — English, 中文, Tiếng Viet + 9 more locales

## Getting Started

### Development

```bash
git clone https://github.com/xcodethink/OpenOrangeDuck.git
cd OpenOrangeDuck
npm install
npm run dev    # Development with hot reload
```

### Build & Load

```bash
npm run build  # Production build
```

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

## Configuration

Two modes are available:

1. **Own API Key (recommended for self-hosting)** — Bring your own key from any supported provider (Claude, OpenAI, Gemini, Grok, or custom endpoint). Configure in Settings page.
2. **Backend Proxy** — Connect to your own backend API for pay-as-you-go AI access. See `src/types/settings.ts` for endpoint configuration.

## Backend API

OrangeDuck works standalone for bookmark management. For safety check and cloud features, you need a backend API that provides:

- `/v1/check` — Domain safety check endpoint
- `/v1/auth/*` — Authentication endpoints
- `/v1/backup/*` — Cloud backup endpoints

Search for `your-api.example.com` and `your-site.example.com` in the codebase to find all endpoints that need configuration.

## Usage

### Save a Bookmark

- **Right-click** on any webpage -> "Save to Smart Bookmarks"
- **Keyboard shortcut**: `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`)
- **Click** the extension icon in toolbar

### Open Manager

- **Keyboard shortcut**: `Ctrl+Shift+B` (Mac: `Cmd+Shift+B`)
- New tab page will show the manager automatically

### Semantic Search

Enter keywords in the search bar. The semantic search will expand your query:
- "AI" -> matches "artificial intelligence", "machine learning", "GPT", etc.
- "前端框架" -> matches "React", "Vue", "Angular", etc.

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS
- Zustand (State Management)
- Dexie.js (IndexedDB)
- Vite (Build)
- i18next (i18n)

## Project Structure

```
├── manifest.json          # Chrome Extension Manifest V3
├── icons/                 # Extension icons (SVG + PNG)
├── _locales/              # Chrome i18n (10 locales)
├── src/
│   ├── background/        # Service Worker
│   ├── content/           # Content Script (risk badge injection)
│   ├── popup/             # Popup UI
│   ├── options/           # Settings page
│   ├── manager/           # Main manager UI (new-tab override)
│   ├── welcome/           # First-install welcome page
│   ├── warning/           # Safety warning interstitial
│   ├── auth/              # Authentication UI
│   ├── classify/          # AI classification page
│   ├── dedupe/            # Deduplication page
│   ├── tags/              # Tag management page
│   ├── components/        # Shared React components
│   ├── services/          # Core services (AI, database, auth, backup, safety)
│   ├── stores/            # Zustand stores
│   ├── types/             # TypeScript types
│   ├── i18n/              # Translations (en, zh, vi)
│   └── utils/             # Utilities (URL, similarity, brand detection)
├── PRIVACY.md             # Privacy Policy (template)
└── LICENSE                # Apache-2.0
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

## Privacy

All bookmark data is stored locally on your device. Page content is only sent to the AI provider you configure. Domain safety checks use the configured backend API — no browsing history is stored. See [PRIVACY.md](PRIVACY.md) for the full policy template.

## License

Apache-2.0 License — See [LICENSE](LICENSE) for details.
