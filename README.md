# OrangeDuck - Smart Bookmarks

**AI-Powered Bookmark Manager Chrome Extension**

An open-source Chrome extension that combines intelligent bookmark management with AI-powered features. Supports multiple AI providers (Claude, OpenAI, Gemini, Grok) for smart summarization, classification, and search.

## Features

- **AI Summary** -- Auto-generate summaries via Claude, OpenAI, Gemini, Grok, or custom API
- **Semantic Search** -- Search by meaning, not just keywords
- **Page Snapshots** -- Save page content (3 levels: text / images / full HTML)
- **Health Check** -- Detect dead links; view snapshots of offline pages
- **Smart Deduplication** -- Same URL / same domain / similar content detection
- **Auto Classify** -- AI-powered folder organization
- **Timeline View** -- Browse bookmarks chronologically
- **Tag Manager** -- Auto-generated tags with merge & rename
- **Domain Safety Check** -- Real-time phishing & scam detection (requires backend API)
- **Import / Export** -- Chrome bookmarks, HTML, JSON
- **Multi-language** -- English, Chinese, Vietnamese + 9 more locales
- **Cloud Backup** -- End-to-end encrypted sync (requires backend API)

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
git clone https://github.com/xcodethink/OpenOrangeDuck.git
cd OrangeDuck
npm install
```

### Development

```bash
npm run dev    # Development with hot reload
```

### Build

```bash
npm run build  # Production build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

## Configuration

Two modes are available:

1. **Own API Key (recommended for self-hosting)** -- Bring your own key from any supported provider (Claude, OpenAI, Gemini, Grok, or custom endpoint). Configure in Settings page.
2. **Proxy Mode** -- Point to your own backend API for centralized billing and user management. See [Backend Setup](#backend-setup) below.

## Backend Setup

Some features (cloud backup, domain safety check, proxy mode) require a backend API. You need to:

1. Set up your own API server (e.g., Cloudflare Workers, Node.js, etc.)
2. Update `DEFAULT_PROXY_ENDPOINT` in `src/types/settings.ts`
3. Update the safety check API in `src/services/safetyCheck.ts`
4. Set your Google OAuth client ID in `src/services/auth.ts` (for Google sign-in)

The extension works fully offline for core bookmark management features without a backend.

## Tech Stack

- React 18 + TypeScript
- Tailwind CSS
- Zustand (State Management)
- Dexie.js (IndexedDB)
- Vite + CRXJS (Chrome Extension Build)
- i18next (Internationalization)

## Project Structure

```
OrangeDuck/
├── manifest.json          # Chrome Extension Manifest V3
├── icons/                 # Extension icons (SVG + PNG)
├── _locales/              # Chrome i18n (10 languages)
├── src/
│   ├── background/        # Service Worker
│   ├── content/           # Content Script (page extraction)
│   ├── popup/             # Popup UI
│   ├── options/           # Settings page
│   ├── manager/           # Main manager UI (new-tab override)
│   ├── welcome/           # First-install welcome page
│   ├── warning/           # Domain safety warning page
│   ├── auth/              # Authentication UI
│   ├── classify/          # AI classification page
│   ├── dedupe/            # Deduplication page
│   ├── tags/              # Tag management page
│   ├── components/        # Shared React components
│   ├── services/          # Core services (AI, database, auth, backup)
│   ├── stores/            # Zustand stores
│   ├── types/             # TypeScript types
│   ├── hooks/             # React hooks
│   ├── i18n/              # Translation files
│   └── utils/             # Utilities
└── LICENSE                # GPL-3.0
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint check |
| `npm run test` | Run tests |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the GPL-3.0 License -- see the [LICENSE](LICENSE) file for details.
