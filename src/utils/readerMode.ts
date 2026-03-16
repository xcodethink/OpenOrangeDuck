/**
 * Reader Mode HTML Document Builder
 *
 * Generates a self-contained HTML document with professional typography CSS
 * for rendering in a sandboxed iframe. Supports dark/light themes.
 */

interface ReaderModeOptions {
  html: string;
  title?: string;
  theme: 'dark' | 'light';
  showImages?: boolean;
}

// Simple HTML sanitization: strip script/style tags and on* event handlers
function sanitizeHtml(html: string): string {
  return html
    // Remove <script>...</script> (including multiline)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove <style>...</style>
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove on* event handler attributes
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getReaderCSS(theme: 'dark' | 'light', showImages: boolean): string {
  const isDark = theme === 'dark';

  return `
    :root {
      --reader-bg: ${isDark ? '#0f172a' : '#ffffff'};
      --reader-text: ${isDark ? '#cbd5e1' : '#374151'};
      --reader-heading: ${isDark ? '#f1f5f9' : '#111827'};
      --reader-muted: ${isDark ? '#64748b' : '#9ca3af'};
      --reader-link: ${isDark ? '#a78bfa' : '#7c3aed'};
      --reader-link-hover: ${isDark ? '#c4b5fd' : '#6d28d9'};
      --reader-code-bg: ${isDark ? '#1e293b' : '#f3f4f6'};
      --reader-code-border: ${isDark ? '#334155' : '#e5e7eb'};
      --reader-blockquote-border: ${isDark ? '#6366f1' : '#8b5cf6'};
      --reader-blockquote-bg: ${isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(139, 92, 246, 0.05)'};
      --reader-table-border: ${isDark ? '#334155' : '#e5e7eb'};
      --reader-table-header-bg: ${isDark ? '#1e293b' : '#f9fafb'};
      --reader-table-stripe: ${isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(249, 250, 251, 0.8)'};
      --reader-hr: ${isDark ? '#334155' : '#e5e7eb'};
      --reader-selection-bg: ${isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)'};
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    ::selection {
      background: var(--reader-selection-bg);
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      color: var(--reader-text);
      background: var(--reader-bg);
      line-height: 1.75;
      font-size: 15px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    article {
      max-width: 680px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      color: var(--reader-heading);
      font-weight: 700;
      line-height: 1.3;
      margin-top: 1.75em;
      margin-bottom: 0.5em;
    }

    h1 { font-size: 1.875rem; letter-spacing: -0.02em; }
    h2 { font-size: 1.5rem; letter-spacing: -0.01em; }
    h3 { font-size: 1.25rem; }
    h4 { font-size: 1.125rem; }
    h5 { font-size: 1rem; }
    h6 { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; }

    /* First heading in article should have no top margin */
    article > h1:first-child,
    article > h2:first-child,
    article > h3:first-child {
      margin-top: 0;
    }

    /* Paragraphs */
    p {
      margin-bottom: 1em;
    }

    /* Links */
    a {
      color: var(--reader-link);
      text-decoration: underline;
      text-underline-offset: 2px;
      text-decoration-thickness: 1px;
      transition: color 0.15s ease;
    }

    a:hover {
      color: var(--reader-link-hover);
    }

    /* Lists */
    ul, ol {
      padding-left: 1.5em;
      margin-bottom: 1em;
    }

    li {
      margin-bottom: 0.375em;
    }

    li > ul, li > ol {
      margin-top: 0.375em;
      margin-bottom: 0;
    }

    /* Blockquotes */
    blockquote {
      border-left: 3px solid var(--reader-blockquote-border);
      background: var(--reader-blockquote-bg);
      padding: 0.75em 1em;
      margin: 1.25em 0;
      border-radius: 0 6px 6px 0;
      font-style: italic;
      color: var(--reader-muted);
    }

    blockquote p:last-child {
      margin-bottom: 0;
    }

    /* Code */
    code {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
      font-size: 0.875em;
      background: var(--reader-code-bg);
      border: 1px solid var(--reader-code-border);
      padding: 0.125em 0.375em;
      border-radius: 4px;
    }

    pre {
      background: var(--reader-code-bg);
      border: 1px solid var(--reader-code-border);
      border-radius: 8px;
      padding: 1em;
      margin: 1.25em 0;
      overflow-x: auto;
      line-height: 1.5;
    }

    pre code {
      background: none;
      border: none;
      padding: 0;
      font-size: 0.85em;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.25em 0;
      font-size: 0.9em;
    }

    th, td {
      border: 1px solid var(--reader-table-border);
      padding: 0.5rem 0.75rem;
      text-align: left;
    }

    th {
      background: var(--reader-table-header-bg);
      font-weight: 600;
      color: var(--reader-heading);
    }

    tr:nth-child(even) {
      background: var(--reader-table-stripe);
    }

    /* Horizontal Rule */
    hr {
      border: none;
      border-top: 1px solid var(--reader-hr);
      margin: 2em 0;
    }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1em 0;
      display: block;
    }

    figure {
      margin: 1.5em 0;
      text-align: center;
    }

    figcaption {
      font-size: 0.875em;
      color: var(--reader-muted);
      margin-top: 0.5em;
      font-style: italic;
    }

    /* Strong and Em */
    strong, b {
      font-weight: 600;
      color: var(--reader-heading);
    }

    /* Definition Lists */
    dl {
      margin-bottom: 1em;
    }

    dt {
      font-weight: 600;
      color: var(--reader-heading);
      margin-top: 0.75em;
    }

    dd {
      margin-left: 1.5em;
      margin-bottom: 0.5em;
    }

    /* Abbreviations */
    abbr[title] {
      text-decoration: underline dotted;
      cursor: help;
    }

    /* Mark */
    mark {
      background: ${isDark ? 'rgba(250, 204, 21, 0.2)' : 'rgba(250, 204, 21, 0.3)'};
      color: inherit;
      padding: 0.1em 0.2em;
      border-radius: 2px;
    }

    /* Details/Summary */
    details {
      margin: 1em 0;
      border: 1px solid var(--reader-code-border);
      border-radius: 6px;
      padding: 0.75em;
    }

    summary {
      cursor: pointer;
      font-weight: 600;
      color: var(--reader-heading);
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: ${isDark ? '#475569' : '#d1d5db'};
      border-radius: 3px;
    }

    ${!showImages ? `
    img, picture, figure, video, canvas, svg {
      display: none !important;
    }
    ` : ''}
  `;
}

export function buildReaderModeDocument(options: ReaderModeOptions): string {
  const { html, title = '', theme, showImages = true } = options;

  const sanitized = sanitizeHtml(html);
  const css = getReaderCSS(theme, showImages);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <article>${sanitized}</article>
</body>
</html>`;
}
