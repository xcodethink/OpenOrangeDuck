# ScamLens Smart Bookmarks

**AI-Powered Bookmark Manager & Domain Safety Checker**

A Chrome extension that combines intelligent bookmark management with real-time domain safety analysis. Part of the [ScamLens](https://scamlens.org) security platform.

智能收藏夹 — AI 书签管理 + 域名安全检测 Chrome 扩展，[ScamLens](https://scamlens.org) 安全平台的一部分。

## Features

- **Domain Safety Check** — Real-time phishing, scam & malware detection powered by multi-source threat intelligence
- **AI Summary** — Auto-generate summaries via Claude, OpenAI, Gemini, Grok, or custom API
- **Semantic Search** — Search by meaning, not just keywords
- **Page Snapshots** — Save page content (3 levels: text / images / full HTML)
- **Health Check** — Detect dead links; view snapshots of offline pages
- **Smart Deduplication** — Same URL / same domain / similar content detection
- **Auto Classify** — AI-powered folder organization
- **Timeline View** — Browse bookmarks chronologically
- **Tag Manager** — Auto-generated tags with merge & rename
- **Import / Export** — Chrome bookmarks, HTML, JSON
- **Multi-language** — English, 中文, Tiếng Việt + 9 more locales

## Installation

### From Chrome Web Store

Install directly from the [Chrome Web Store](https://scamlens.org/en/extension).

### Development

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/xcodethink/OpenOrangeDuck.git
   cd OpenOrangeDuck
   npm install
   ```

2. Build the extension:
   ```bash
   npm run dev    # Development with hot reload
   # or
   npm run build  # Production build
   ```

3. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Configuration

Two modes are available:

1. **Official Proxy (recommended)** — Pay-as-you-go, no API key needed. Sign in and recharge in Settings.
2. **Own API Key** — Bring your own key from any supported provider (Claude, OpenAI, Gemini, Grok, or custom endpoint).

## Usage

### Save a Bookmark

- **Right-click** on any webpage → "Save to Smart Bookmarks"
- **Keyboard shortcut**: `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`)
- **Click** the extension icon in toolbar

### Open Manager

- **Keyboard shortcut**: `Ctrl+Shift+B` (Mac: `Cmd+Shift+B`)
- New tab page will show the manager automatically

### Semantic Search

Enter keywords in the search bar. The semantic search will expand your query:
- "AI" → matches "artificial intelligence", "machine learning", "GPT", etc.
- "前端框架" → matches "React", "Vue", "Angular", etc.

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
├── _locales/              # Chrome i18n
├── src/
│   ├── background/        # Service Worker
│   ├── content/           # Content Script
│   ├── popup/             # Popup UI
│   ├── options/           # Settings page
│   ├── manager/           # Main manager UI (new-tab override)
│   ├── welcome/           # First-install welcome page
│   ├── auth/              # Authentication UI
│   ├── components/        # Shared React components
│   ├── services/          # Core services (AI, database, auth, backup)
│   ├── stores/            # Zustand stores
│   ├── types/             # TypeScript types
│   ├── i18n/              # Translations
│   └── utils/             # Utilities
├── PRIVACY.md             # Privacy Policy
└── LICENSE                # Apache-2.0
```

## Community

- **Report a scam**: [scamlens.org/en/report-scam](https://scamlens.org/en/report-scam)
- **Scam guide**: [scamlens.org/en/scams](https://scamlens.org/en/scams)
- **Email**: wayne@wayjet.io

## Privacy

All bookmark data is stored locally on your device. Page content is only sent to the AI provider you configure. Domain safety checks use our secure API — no browsing history is stored. See [PRIVACY.md](PRIVACY.md) for the full policy.

## License

Apache-2.0 License — See [LICENSE](LICENSE) for details.
