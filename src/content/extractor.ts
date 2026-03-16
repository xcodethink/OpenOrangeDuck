// Content extractor using a simplified Readability-like approach

export interface ExtractedContent {
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
  images: string[];
  canonicalUrl?: string;
}

// Selectors for content that should be removed
const REMOVE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'nav',
  'header',
  'footer',
  'aside',
  '.sidebar',
  '.advertisement',
  '.ads',
  '.ad',
  '#comments',
  '.comments',
  '.social-share',
  '.related-posts',
];

// Selectors for main content
const CONTENT_SELECTORS = [
  'article',
  '[role="main"]',
  'main',
  '.post-content',
  '.entry-content',
  '.article-content',
  '.content',
  '#content',
  '.post',
  '.article',
];

export function extractContent(): ExtractedContent {
  // Clone document to avoid modifying the original
  const doc = document.cloneNode(true) as Document;

  // Remove unwanted elements
  REMOVE_SELECTORS.forEach(selector => {
    doc.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Try to find main content
  let mainContent: Element | null = null;
  for (const selector of CONTENT_SELECTORS) {
    mainContent = doc.querySelector(selector);
    if (mainContent) break;
  }

  // Fallback to body
  if (!mainContent) {
    mainContent = doc.body;
  }

  // Extract text content
  const textContent = mainContent?.textContent?.trim() || '';

  // Clean and format text
  const cleanedText = textContent
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  // Enhanced image extraction
  const images: string[] = [];
  const seenUrls = new Set<string>();
  const MAX_IMAGES = 20;

  function addImage(src: string | null | undefined) {
    if (!src || images.length >= MAX_IMAGES) return;
    if (src.startsWith('data:')) return;
    try {
      const absoluteUrl = new URL(src, window.location.href).href;
      if (!seenUrls.has(absoluteUrl)) {
        seenUrls.add(absoluteUrl);
        images.push(absoluteUrl);
      }
    } catch { /* skip invalid URLs */ }
  }

  // 1. Meta images (from full document — most reliable for hero images)
  const metaSelectors = [
    'meta[property="og:image"]',
    'meta[property="og:image:secure_url"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
    'meta[itemprop="image"]',
  ];
  for (const sel of metaSelectors) {
    const el = document.querySelector(sel);
    if (el) addImage(el.getAttribute('content'));
  }

  // 2. <img> tags in main content — expanded lazy-loading support
  const imgElements = mainContent?.querySelectorAll('img') || [];
  for (const img of imgElements) {
    addImage(img.getAttribute('src'));
    addImage(img.getAttribute('data-src'));
    addImage(img.getAttribute('data-original'));
    addImage(img.getAttribute('data-lazy-src'));
    // srcset: pick the largest variant
    const srcset = img.getAttribute('srcset');
    if (srcset) {
      const candidates = srcset.split(',').map(s => s.trim().split(/\s+/));
      const best = candidates.sort((a, b) => parseFloat(b[1] || '0') - parseFloat(a[1] || '0'))[0];
      if (best) addImage(best[0]);
    }
  }

  // 3. <picture> elements
  const pictureElements = mainContent?.querySelectorAll('picture') || [];
  for (const picture of pictureElements) {
    const sources = picture.querySelectorAll('source');
    for (const source of sources) {
      const srcset = source.getAttribute('srcset');
      if (srcset) addImage(srcset.split(',')[0]?.trim()?.split(/\s+/)[0]);
    }
    const img = picture.querySelector('img');
    if (img) addImage(img.getAttribute('src'));
  }

  // 4. CSS background images in main content
  const bgElements = mainContent?.querySelectorAll('[style*="background"]') || [];
  for (const el of bgElements) {
    const style = el.getAttribute('style') || '';
    const match = style.match(/url\(['"]?(.*?)['"]?\)/);
    if (match) addImage(match[1]);
  }

  // Get canonical URL if exists
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  const canonicalUrl = canonicalLink?.getAttribute('href') || undefined;

  // Get title
  const title = document.title || document.querySelector('h1')?.textContent || '';

  // Generate excerpt (first 200 chars)
  const excerpt = cleanedText.substring(0, 200) + (cleanedText.length > 200 ? '...' : '');

  return {
    title: title.trim(),
    content: mainContent?.innerHTML || '',
    textContent: cleanedText,
    excerpt,
    images,
    canonicalUrl,
  };
}

// Get page metadata
export function getPageMetadata() {
  return {
    url: window.location.href,
    title: document.title,
    favicon: getFavicon(),
    description: getMetaDescription(),
  };
}

function getFavicon(): string {
  // Try various favicon sources
  const sources = [
    document.querySelector('link[rel="icon"]')?.getAttribute('href'),
    document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href'),
    document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
    '/favicon.ico',
  ];

  for (const src of sources) {
    if (src) {
      try {
        return new URL(src, window.location.href).href;
      } catch {
        continue;
      }
    }
  }

  return `https://www.google.com/s2/favicons?domain=${window.location.hostname}&sz=32`;
}

function getMetaDescription(): string {
  const metaDesc = document.querySelector('meta[name="description"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  return metaDesc?.getAttribute('content') || ogDesc?.getAttribute('content') || '';
}
