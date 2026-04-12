import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase, bookmarkService } from '../services/database';
import { aiService } from '../services/ai';
import { snapshotService } from '../services/snapshot';
import { embeddingService } from '../services/embedding';
import { storageService } from '../services/storage';
import { normalizeUrl, extractFavicon, extractDomain, isSafeUrl } from '../utils/url';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { Bookmark, BookmarkStatus, SnapshotLevel, DomainInfo } from '../types';
import { checkUrlSafety, isDomainBypassed, isDomainWhitelisted, shouldWarn, buildWarningUrl } from '../services/safetyCheck';

// Global error boundary — prevent Service Worker crash on unhandled rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Prevent SW termination
});

const SETTINGS_KEY = 'smartBookmarksSettings';

async function getAiNotConfiguredError(): Promise<string> {
  const settings = await storageService.getSettings();
  if (settings.apiMode === 'proxy') {
    return 'AI_NOT_LOGGED_IN';
  }
  return 'AI_NOT_CONFIGURED';
}

// Track in-progress saves to prevent duplicates
const savingUrls = new Set<string>();

// ===== RDAP Domain Intelligence Lookup =====

interface RDAPBootstrap {
  services: [string[], string[]][];
  version: string;
}

interface RDAPDomainResponse {
  ldhName?: string;
  entities?: Array<{
    roles?: string[];
    vcardArray?: [string, ...unknown[][]];
    publicIds?: Array<{ identifier: string; type: string }>;
  }>;
  events?: Array<{ eventAction: string; eventDate: string }>;
  nameservers?: Array<{ ldhName: string }>;
  secureDNS?: { delegationSigned?: boolean };
  status?: string[];
}

let rdapBootstrapCache: RDAPBootstrap | null = null;
let rdapBootstrapFetchedAt = 0;
const RDAP_BOOTSTRAP_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getRDAPBootstrap(): Promise<RDAPBootstrap> {
  if (rdapBootstrapCache && Date.now() - rdapBootstrapFetchedAt < RDAP_BOOTSTRAP_TTL) {
    return rdapBootstrapCache;
  }
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10000);
  const response = await fetch('https://data.iana.org/rdap/dns.json', { signal: ctrl.signal });
  clearTimeout(tid);
  if (!response.ok) throw new Error('Failed to fetch RDAP bootstrap');
  rdapBootstrapCache = await response.json() as RDAPBootstrap;
  rdapBootstrapFetchedAt = Date.now();
  return rdapBootstrapCache;
}

function findRDAPServer(bootstrap: RDAPBootstrap, domain: string): string | null {
  const parts = domain.split('.');
  const tld = (parts.pop() || '').toLowerCase();
  const sldTld = parts.length >= 1 ? parts[parts.length - 1].toLowerCase() + '.' + tld : '';

  for (const [tlds, urls] of bootstrap.services) {
    for (const t of tlds) {
      if (t.toLowerCase() === tld || t.toLowerCase() === sldTld) {
        return urls[0];
      }
    }
  }
  return null;
}

function extractRegistrar(entities: RDAPDomainResponse['entities']): string | undefined {
  if (!entities) return undefined;
  for (const entity of entities) {
    if (entity.roles?.includes('registrar')) {
      if (entity.vcardArray && entity.vcardArray.length >= 2) {
        const vcard = entity.vcardArray[1] as unknown[][];
        for (const prop of vcard) {
          if (Array.isArray(prop) && prop[0] === 'fn') {
            return prop[3] as string;
          }
        }
      }
      if (entity.publicIds && entity.publicIds.length > 0) {
        return entity.publicIds[0].identifier;
      }
    }
  }
  return undefined;
}

function extractEventDate(events: RDAPDomainResponse['events'], action: string): string | undefined {
  if (!events) return undefined;
  const event = events.find(e => e.eventAction === action);
  return event?.eventDate;
}

const DOMAIN_INTEL_CACHE_PREFIX = 'rdap_cache_';
const DOMAIN_INTEL_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getCachedRDAP(domain: string): Promise<DomainInfo | null> {
  try {
    const key = DOMAIN_INTEL_CACHE_PREFIX + domain;
    const result = await chrome.storage.local.get(key);
    const cached = result[key];
    if (cached && cached.fetchedAt && Date.now() - cached.fetchedAt < DOMAIN_INTEL_TTL) {
      return cached.data as DomainInfo;
    }
    return null;
  } catch { return null; }
}

async function setCachedRDAP(domain: string, data: DomainInfo): Promise<void> {
  try {
    const key = DOMAIN_INTEL_CACHE_PREFIX + domain;
    await chrome.storage.local.set({ [key]: { data, fetchedAt: Date.now() } });
  } catch { /* caching is optional */ }
}

// Try a single RDAP lookup for a given domain, returns true if data was found
async function tryRDAPLookup(domain: string, result: DomainInfo): Promise<boolean> {
  const bootstrap = await getRDAPBootstrap();
  const serverUrl = findRDAPServer(bootstrap, domain);
  if (!serverUrl) return false;

  const rdapUrl = `${serverUrl.replace(/\/+$/, '')}/domain/${domain}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(rdapUrl, {
    signal: controller.signal,
    headers: { 'Accept': 'application/rdap+json' },
  });
  clearTimeout(timeoutId);

  if (!response.ok) return false;

  const data = await response.json() as RDAPDomainResponse;

  result.registrar = extractRegistrar(data.entities);
  result.createdDate = extractEventDate(data.events, 'registration');
  result.expiresDate = extractEventDate(data.events, 'expiration');
  result.updatedDate = extractEventDate(data.events, 'last changed');
  result.nameservers = data.nameservers?.map(ns => ns.ldhName).filter(Boolean) || [];
  result.dnssec = data.secureDNS?.delegationSigned ?? false;
  result.domainStatus = data.status || [];

  return Boolean(result.registrar || result.createdDate);
}

// Extract parent domain for ccTLD fallback (e.g., "hsbc.com.vn" → "hsbc.com")
function getParentDomain(domain: string): string | null {
  const parts = domain.split('.');
  // Need at least 3 parts for a ccTLD subdomain (e.g., hsbc.com.vn)
  if (parts.length < 3) return null;
  // Check if it's a two-part TLD (com.vn, co.uk, com.au, etc.)
  const twoPartTLDs = ['com', 'co', 'net', 'org', 'edu', 'gov', 'ac'];
  const secondLast = parts[parts.length - 2];
  if (twoPartTLDs.includes(secondLast) && parts.length >= 3) {
    // hsbc.com.vn → hsbc.com
    return parts.slice(0, -1).join('.');
  }
  return null;
}

async function lookupRDAP(domain: string): Promise<DomainInfo> {
  const cached = await getCachedRDAP(domain);
  if (cached) return cached;

  const result: DomainInfo = { domain };

  try {
    const found = await tryRDAPLookup(domain, result);

    // Fallback: if ccTLD RDAP returned no data, try parent domain
    // e.g., hsbc.com.vn has no RDAP → try hsbc.com
    if (!found) {
      const parentDomain = getParentDomain(domain);
      if (parentDomain) {
        console.debug('[RDAP] Falling back to parent domain:', parentDomain);
        await tryRDAPLookup(parentDomain, result);
      }
    }
  } catch (error) {
    console.warn('[RDAP] Lookup failed for', domain, error);
  }

  await setCachedRDAP(domain, result);
  return result;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === 'install') {
      // Initialize storage defaults on first install
      const result = await chrome.storage.local.get(SETTINGS_KEY);
      if (!result[SETTINGS_KEY]) {
        await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
      }
      // Open welcome page for new users
      chrome.tabs.create({ url: chrome.runtime.getURL('src/welcome/index.html') });
    }

    if (details.reason === 'update') {
      // Migration hook: update API endpoint if needed
      // const result = await chrome.storage.local.get(SETTINGS_KEY);
      // const settings = result[SETTINGS_KEY];
      // if (settings?.proxyEndpoint?.includes('old-domain.example.com')) {
      //   settings.proxyEndpoint = 'https://your-api.example.com/v1';
      //   await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
      // }
    }

    await initializeDatabase();
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
  setupContextMenu();
  setupAlarms();

  // Set uninstall survey URL (optional)
  // chrome.runtime.setUninstallURL('https://your-site.example.com/uninstall');
});

// Re-initialize on browser startup (service worker may have been terminated)
chrome.runtime.onStartup.addListener(async () => {
  try {
    // Verify storage exists, reinitialize if needed
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    if (!result[SETTINGS_KEY]) {
      await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    }
    await initializeDatabase();
  } catch (error) {
    console.error('Failed to initialize on startup:', error);
  }
  setupContextMenu();
  setupAlarms();
});

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.error('Failed to remove context menus:', chrome.runtime.lastError);
    }
    chrome.contextMenus.create({
      id: 'save-to-orangeduck',
      title: chrome.i18n.getMessage('cmdSaveBookmark') || 'Save to OrangeDuck',
      contexts: ['page', 'link'],
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to create context menu:', chrome.runtime.lastError);
      }
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-to-orangeduck' && tab?.id) {
    const url = info.linkUrl || info.pageUrl || tab.url;
    if (url) {
      await saveBookmark(tab.id, url);
    }
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  try {
    if (command === 'save-bookmark') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url) {
        await saveBookmark(tab.id, tab.url);
      }
    }

    if (command === 'open-manager') {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/index.html') });
    }
  } catch (error) {
    console.error('Command handler error:', error);
  }
});

async function saveBookmark(
  tabId: number,
  url: string,
  folderId: string = 'all',
  snapshotLevel: SnapshotLevel = 'L1'
): Promise<{ success: boolean; bookmark?: Bookmark; error?: string }> {
  // Only allow http/https URLs — blocks javascript:, data:, file:, chrome://, etc.
  if (!isSafeUrl(url)) {
    return { success: false, error: 'Cannot bookmark this URL' };
  }

  // Prevent rapid duplicate saves
  const normalizedUrl = normalizeUrl(url);
  if (savingUrls.has(normalizedUrl)) {
    return { success: false, error: 'Save already in progress' };
  }

  savingUrls.add(normalizedUrl);

  try {
    const existing = await bookmarkService.getByNormalizedUrl(normalizedUrl);
    if (existing) {
      return { success: false, error: 'URL already bookmarked' };
    }

    // Extract content from page with retry
    const response = await extractContentWithRetry(tabId, 2, 1000);
    if (!response.success) {
      throw new Error(response.error || 'Failed to extract content');
    }

    const { title, textContent, content, images, canonicalUrl, favicon } = response.data!;
    const safeTextContent = textContent || '';
    const safeTitle = (title || 'Untitled').slice(0, 500);

    if (safeTextContent.length < 10) {
      console.warn('[SaveBookmark] Content is empty or too short, using minimal content');
    }

    let summary = '';
    let tags: string[] = [];

    // Use content for AI, fallback to title if content is too short
    const aiInput = safeTextContent.length > 10 ? safeTextContent : safeTitle;

    const isConfigured = await aiService.isConfigured();
    if (isConfigured && aiInput.length > 10) {
      try {
        const aiResult = await aiService.generateSummary(aiInput, safeTitle);
        summary = aiResult.summary;
        tags = aiResult.tags;
      } catch (error) {
        console.error('AI processing failed:', error);
        // Show upgrade prompt when usage limit is hit
        if (error instanceof Error && error.message === 'USAGE_LIMIT_REACHED') {
          showNotification(
            'AI Limit Reached',
            'Your monthly AI quota is used up. Upgrade to Pro for 200 analyses/month.'
          );
        }
        summary = (safeTextContent || safeTitle).substring(0, 200);
        tags = ['uncategorized'];
      }
    } else {
      // No AI: use content if available, otherwise title
      const fallbackText = safeTextContent || safeTitle;
      summary = fallbackText.substring(0, 200) + (fallbackText.length > 200 ? '...' : '');
      tags = ['uncategorized'];
    }

    // Resolve snapshot level (falls back to L1 if user can't afford L2/L3)
    const resolvedLevel = await snapshotService.resolveLevel(snapshotLevel);

    const snapshotContent: Bookmark['content'] = {
      text: safeTextContent,
    };

    // Always store cleaned HTML for reader mode (all levels)
    if (content) {
      if (resolvedLevel === 'L2' || resolvedLevel === 'L3') {
        // Download images and embed as base64 in HTML
        const { processedHtml, base64Images } = await processImagesForStorage(
          content,
          images || []
        );
        snapshotContent.html = processedHtml;
        snapshotContent.images = base64Images;
      } else {
        // L1: store HTML as-is (images hidden by reader mode CSS)
        snapshotContent.html = content;
      }
    }

    // L3: capture page screenshot
    if (resolvedLevel === 'L3') {
      const screenshot = await captureScreenshot(tabId);
      if (screenshot) snapshotContent.screenshot = screenshot;
    }

    const snapshotSize = calculateSize(snapshotContent);

    const now = new Date().toISOString();
    const bookmark: Bookmark = {
      id: uuidv4(),
      url,
      normalizedUrl,
      canonicalUrl,
      domain: extractDomain(url),
      title: safeTitle,
      favicon: favicon || extractFavicon(url),
      summary,
      tags,
      content: snapshotContent,
      snapshot: {
        level: resolvedLevel,
        size: snapshotSize,
        createdAt: now,
      },
      status: 'healthy',
      folderId: folderId || 'all',
      createdAt: now,
      refreshedAt: now,
    };

    await bookmarkService.create(bookmark);

    // Fire-and-forget: generate embedding if user is logged in
    generateEmbeddingAsync(bookmark.id, safeTitle, summary, tags);

    showNotification('Bookmark Saved', `"${safeTitle}" has been saved.`);

    return { success: true, bookmark };
  } catch (error) {
    console.error('Failed to save bookmark:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showNotification('Error', `Failed to save bookmark: ${errorMessage}`);
    return { success: false, error: errorMessage };
  } finally {
    // Always clear the save lock
    savingUrls.delete(normalizedUrl);
  }
}

/**
 * Fire-and-forget embedding generation. Does not block bookmark save.
 */
function generateEmbeddingAsync(bookmarkId: string, title: string, summary: string, tags: string[]) {
  (async () => {
    try {
      const settings = await storageService.getSettings();
      if (!settings.userId || !settings.userToken) return; // Not logged in
      if (settings.autoEmbedding === false) return; // User opted out

      const text = [title, summary, ...tags].filter(Boolean).join(' ');
      if (text.length < 10) return;

      await embeddingService.generateEmbedding(bookmarkId, text);
    } catch {
      // Silently fail — embedding is optional enhancement
    }
  })();
}

function calculateSize(content: Bookmark['content']): string {
  let totalBytes = 0;

  if (content.text) {
    totalBytes += new Blob([content.text]).size;
  }

  if (content.html) {
    totalBytes += new Blob([content.html]).size;
  }

  if (content.images) {
    for (const img of content.images) {
      if (img.startsWith('data:')) {
        // Base64 data URI: actual size ≈ 75% of string length
        totalBytes += Math.round(img.length * 0.75);
      } else {
        totalBytes += 50000; // URL-only fallback estimate
      }
    }
  }

  if (content.screenshot) {
    totalBytes += Math.round(content.screenshot.length * 0.75);
  }

  if (totalBytes < 1024) {
    return `${totalBytes}B`;
  } else if (totalBytes < 1024 * 1024) {
    return `${Math.round(totalBytes / 1024)}KB`;
  } else {
    return `${(totalBytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

/**
 * Download an image and convert to base64 data URI.
 * Runs in service worker context — host_permissions bypass CORS.
 */
async function downloadImageAsBase64(url: string, timeoutMs = 10000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;

    const blob = await response.blob();
    // Skip tracking pixels (< 1KB) and huge images (> 5MB)
    if (blob.size < 1000 || blob.size > 5 * 1024 * 1024) return null;

    // Convert blob to base64 data URI using FileReader
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Process article HTML: download images and replace src with base64 data URIs.
 * Returns processed HTML and array of base64 images for gallery.
 */
async function processImagesForStorage(
  html: string,
  imageUrls: string[]
): Promise<{ processedHtml: string; base64Images: string[] }> {
  const urlToBase64 = new Map<string, string>();
  const base64Images: string[] = [];

  const allUrls = [...new Set(imageUrls)];
  const BATCH_SIZE = 5;

  for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
    const batch = allUrls.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (url) => ({
        url,
        base64: await downloadImageAsBase64(url),
      }))
    );

    for (const { url, base64 } of results) {
      if (base64) {
        urlToBase64.set(url, base64);
        base64Images.push(base64);
      }
    }
  }

  // Replace image URLs in HTML with base64 data URIs
  let processedHtml = html;
  for (const [url, base64] of urlToBase64) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    processedHtml = processedHtml.replace(new RegExp(escaped, 'g'), base64);
  }

  return { processedHtml, base64Images };
}

/**
 * Capture a screenshot of the visible tab.
 * Returns base64 JPEG data URL or null on failure.
 */
async function captureScreenshot(tabId: number): Promise<string | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active) {
      // Activate tab for capture
      await chrome.tabs.update(tabId, { active: true });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return await chrome.tabs.captureVisibleTab(
      tab.windowId,
      { format: 'jpeg', quality: 85 }
    );
  } catch (err) {
    console.warn('[Snapshot] Screenshot capture failed:', err);
    return null;
  }
}

async function showNotification(title: string, message: string) {
  // notifications is an optional permission — request at runtime
  const granted = await chrome.permissions.request({ permissions: ['notifications'] }).catch(() => false);
  if (!granted) return;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title,
    message,
  });
}

async function setupAlarms() {
  const settings = await chrome.storage.local.get(SETTINGS_KEY);
  const interval = settings[SETTINGS_KEY]?.healthCheckInterval || 'weekly';

  // Clear any existing alarm so interval changes take effect
  await chrome.alarms.clear('health-check');

  if (interval === 'never') return;

  const periodMap: Record<string, number> = {
    daily: 60 * 24,
    weekly: 60 * 24 * 7,
    monthly: 60 * 24 * 30,
  };

  chrome.alarms.create('health-check', {
    periodInMinutes: periodMap[interval] || periodMap.weekly,
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'health-check') {
    try {
      await performHealthCheck();
    } catch (error) {
      console.error('Health check alarm failed:', error);
    }
  }
});

// Health check function with batch processing, retry, and two-strike confirmation
async function performHealthCheck() {
  let bookmarks: Bookmark[];
  try {
    bookmarks = await bookmarkService.getAll();
  } catch (error) {
    console.error('Failed to load bookmarks for health check:', error);
    return;
  }

  if (bookmarks.length === 0) return;
  const BATCH_SIZE = 8;
  const TIMEOUT_MS = 15000;

  // Check a single URL — HEAD first, then GET fallback
  // Extension has host_permissions: ["<all_urls>"], so default cors mode works
  const checkUrl = async (bookmark: { id: string; url: string; status: BookmarkStatus }): Promise<{ id: string; status: 'healthy' | 'dead' }> => {
    if (!bookmark.url.startsWith('http://') && !bookmark.url.startsWith('https://')) {
      return { id: bookmark.id, status: 'healthy' };
    }

    // Strategy 1: HEAD with redirect:manual — any HTTP response = alive
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      await fetch(bookmark.url, { method: 'HEAD', signal: ctrl.signal, redirect: 'manual' });
      clearTimeout(tid);
      return { id: bookmark.id, status: 'healthy' };
    } catch { /* continue */ }

    // Strategy 2: GET (host_permissions handles CORS)
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      await fetch(bookmark.url, { method: 'GET', signal: ctrl.signal, redirect: 'manual' });
      clearTimeout(tid);
      return { id: bookmark.id, status: 'healthy' };
    } catch { /* continue */ }

    return { id: bookmark.id, status: 'dead' };
  };

  // ---- Pass 1: check all URLs in batches, write results per batch ----
  const failedBookmarks: { id: string; url: string; status: BookmarkStatus }[] = [];
  let checkedCount = 0;
  const totalCount = bookmarks.length;

  // Send progress update to all extension pages
  const sendProgress = (checked: number, total: number, phase: 'checking' | 'retrying') => {
    chrome.runtime.sendMessage({
      type: 'HEALTH_CHECK_PROGRESS',
      checked, total, phase,
    }).catch(() => {}); // ignore if no listeners
  };

  for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
    const batch = bookmarks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(checkUrl));

    // Separate healthy / failed in this batch
    const healthyIds = batchResults.filter(r => r.status === 'healthy').map(r => r.id);
    const failedIds = batchResults.filter(r => r.status === 'dead').map(r => r.id);

    // Write healthy immediately so progress survives SW termination
    if (healthyIds.length > 0) {
      try { await bookmarkService.bulkUpdateStatus(healthyIds, 'healthy'); } catch {}
    }

    // Collect failed for retry pass
    for (const fid of failedIds) {
      const bm = bookmarks.find(b => b.id === fid);
      if (bm) failedBookmarks.push(bm);
    }

    checkedCount += batch.length;
    sendProgress(checkedCount, totalCount, 'checking');
  }

  // ---- Pass 2: retry all failed URLs once (network hiccup recovery) ----
  let totalHealthy = totalCount - failedBookmarks.length;
  let totalDead = 0;

  if (failedBookmarks.length > 0) {
    // Small delay to let transient network issues clear
    await new Promise(r => setTimeout(r, 2000));

    let retryChecked = 0;
    for (let i = 0; i < failedBookmarks.length; i += BATCH_SIZE) {
      const batch = failedBookmarks.slice(i, i + BATCH_SIZE);
      const retryResults = await Promise.all(batch.map(checkUrl));

      const healthyIds = retryResults.filter(r => r.status === 'healthy').map(r => r.id);
      const stillDeadIds = retryResults.filter(r => r.status === 'dead').map(r => r.id);

      if (healthyIds.length > 0) {
        try { await bookmarkService.bulkUpdateStatus(healthyIds, 'healthy'); } catch {}
        totalHealthy += healthyIds.length;
      }

      // Two-strike rule: only mark dead if it was already dead before this check
      // If bookmark was previously healthy, first failure just keeps it healthy (benefit of the doubt)
      const confirmedDeadIds = stillDeadIds.filter(id => {
        const bm = failedBookmarks.find(b => b.id === id);
        return bm && bm.status === 'dead'; // was already dead → confirmed dead
      });
      const firstStrikeIds = stillDeadIds.filter(id => !confirmedDeadIds.includes(id));

      if (confirmedDeadIds.length > 0) {
        try { await bookmarkService.bulkUpdateStatus(confirmedDeadIds, 'dead'); } catch {}
        totalDead += confirmedDeadIds.length;
      }
      // First-time failures: keep their current status (don't mark dead on a single check)
      totalHealthy += firstStrikeIds.length;

      if (firstStrikeIds.length > 0) {
        console.warn(`[HealthCheck] First-strike (not marking dead):`, firstStrikeIds.length, 'URLs');
      }

      retryChecked += batch.length;
      sendProgress(totalCount + retryChecked, totalCount + failedBookmarks.length, 'retrying');
    }
  }

  return { total: totalCount, healthy: totalHealthy, dead: totalDead };
}

// Inline extraction function to run directly in the page context
function inlineExtractContent() {
  const REMOVE_SELECTORS = [
    'script', 'style', 'noscript', 'iframe', 'nav', 'header', 'footer', 'aside',
    '.sidebar', '.advertisement', '.ads', '.ad', '#comments', '.comments',
    '.social-share', '.related-posts',
  ];
  const CONTENT_SELECTORS = [
    'article', '[role="main"]', 'main', '.post-content', '.entry-content',
    '.article-content', '.content', '#content', '.post', '.article',
  ];

  const doc = document.cloneNode(true) as Document;
  REMOVE_SELECTORS.forEach(selector => {
    doc.querySelectorAll(selector).forEach(el => el.remove());
  });

  let mainContent: Element | null = null;
  for (const selector of CONTENT_SELECTORS) {
    mainContent = doc.querySelector(selector);
    if (mainContent) break;
  }
  if (!mainContent) mainContent = doc.body;

  const textContent = mainContent?.textContent?.trim().replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim() || '';

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
    } catch { /* skip */ }
  }

  // 1. Meta images (full document)
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

  // 2. <img> tags with lazy-loading support
  const imgElements = mainContent?.querySelectorAll('img') || [];
  for (const img of imgElements) {
    addImage(img.getAttribute('src'));
    addImage(img.getAttribute('data-src'));
    addImage(img.getAttribute('data-original'));
    addImage(img.getAttribute('data-lazy-src'));
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

  // 4. CSS background images
  const bgElements = mainContent?.querySelectorAll('[style*="background"]') || [];
  for (const el of bgElements) {
    const style = el.getAttribute('style') || '';
    const match = style.match(/url\(['"]?(.*?)['"]?\)/);
    if (match) addImage(match[1]);
  }

  const canonicalLink = document.querySelector('link[rel="canonical"]');
  const faviconSources = [
    document.querySelector('link[rel="icon"]')?.getAttribute('href'),
    document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href'),
    '/favicon.ico',
  ];
  let favicon = '';
  for (const src of faviconSources) {
    if (src) {
      try { favicon = new URL(src, window.location.href).href; break; } catch {}
    }
  }
  if (!favicon) favicon = `https://www.google.com/s2/favicons?domain=${window.location.hostname}&sz=32`;

  return {
    title: document.title || document.querySelector('h1')?.textContent || '',
    content: mainContent?.innerHTML || '',
    textContent,
    images,
    canonicalUrl: canonicalLink?.getAttribute('href') || undefined,
    favicon,
  };
}

// Extract content using scripting API (primary) with retry.
// Uses progressive delays to handle SPAs that render content asynchronously.
async function extractContentWithRetry(
  tabId: number,
  maxRetries: number = 4,
  _delay: number = 1000
): Promise<{ success: boolean; data?: { textContent: string; content: string; images: string[]; title?: string; favicon?: string; canonicalUrl?: string }; error?: string }> {
  // Progressive delays: 1s → 2s → 4s → 6s (SPA hydration needs time)
  const delays = [1000, 2000, 4000, 6000];
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: inlineExtractContent,
      });

      if (results && results[0] && results[0].result) {
        const data = results[0].result;
        // If content is too short and we have retries left, wait for SPA to render
        if ((!data.textContent || data.textContent.length < 10) && i < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delays[i] || 3000));
          continue;
        }
        return { success: true, data };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      if (errorMsg.includes('Cannot access')) {
        return { success: false, error: 'Cannot extract from this page (protected URL like chrome://, about:, etc.)' };
      }
      if (errorMsg.includes('No tab with id')) {
        return { success: false, error: 'Tab was closed before extraction completed' };
      }
      if (errorMsg.includes('Frame with id')) {
        return { success: false, error: 'Page frame not accessible' };
      }
      // Retry on transient errors
      if (i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delays[i] || 3000));
      } else {
        return { success: false, error: `Extraction failed: ${errorMsg}` };
      }
    }
  }

  return { success: false, error: 'Failed to extract content from page' };
}

// Wait for tab to fully load before extracting content
async function waitForTabReady(tabId: number, timeoutMs: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;

    const listener = (tid: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (tid === tabId && changeInfo.status === 'complete' && !resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        // Wait for page scripts to settle (SPAs need more time to hydrate)
        setTimeout(() => resolve(true), 1500);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // Timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(false);
      }
    }, timeoutMs);
  });
}

async function updateSnapshot(
  bookmarkId: string,
  newLevel: SnapshotLevel
): Promise<{ success: boolean; error?: string }> {
  try {
    const bookmark = await bookmarkService.getById(bookmarkId);
    if (!bookmark) {
      return { success: false, error: 'Bookmark not found' };
    }

    // Try to find existing tab with this URL (use broader matching)
    const allTabs = await chrome.tabs.query({});
    let existingTab = allTabs.find(tab => tab.url === bookmark.url);

    // If no exact match, try normalized comparison
    if (!existingTab) {
      const normalizedTarget = bookmark.url.replace(/\/$/, '').toLowerCase();
      existingTab = allTabs.find(tab => {
        if (!tab.url) return false;
        return tab.url.replace(/\/$/, '').toLowerCase() === normalizedTarget;
      });
    }

    let tabId: number;
    let shouldCloseTab = false;

    if (existingTab?.id) {
      tabId = existingTab.id;
    } else {
      if (!isSafeUrl(bookmark.url)) {
        return { success: false, error: 'Cannot open unsafe URL for snapshot' };
      }
      const newTab = await chrome.tabs.create({ url: bookmark.url, active: false });
      if (!newTab.id) {
        return { success: false, error: 'Failed to open page for snapshot' };
      }
      tabId = newTab.id;
      shouldCloseTab = true;

      await waitForTabReady(tabId, 30000);
    }

    try {
      // Resolve snapshot level first (falls back if user can't afford)
      const resolvedLevel = await snapshotService.resolveLevel(newLevel);

      // Extract content with retry (wait for content script to be ready)
      const response = await extractContentWithRetry(tabId, 4, 1000);

      const textContent = response.data?.textContent || '';
      const content = response.data?.content || '';
      const images = response.data?.images || [];

      // For text/reading modes, require minimum content.
      // For screenshot mode (L3), allow empty text — just capture the page.
      if (resolvedLevel !== 'L3' && textContent.length < 10) {
        return { success: false, error: 'Extracted content is empty or too short' };
      }

      const snapshotContent: Bookmark['content'] = {
        text: textContent,
      };

      // Always store cleaned HTML for reader mode (all levels)
      if (content) {
        if (resolvedLevel === 'L2' || resolvedLevel === 'L3') {
          const { processedHtml, base64Images } = await processImagesForStorage(
            content,
            images || []
          );
          snapshotContent.html = processedHtml;
          snapshotContent.images = base64Images;
        } else {
          snapshotContent.html = content;
        }
      }

      // L3: capture page screenshot
      if (resolvedLevel === 'L3') {
        const screenshot = await captureScreenshot(tabId);
        if (screenshot) snapshotContent.screenshot = screenshot;
      }

      const snapshotSize = calculateSize(snapshotContent);

      await bookmarkService.update(bookmarkId, {
        content: snapshotContent,
        snapshot: {
          level: resolvedLevel,
          size: snapshotSize,
          createdAt: new Date().toISOString(),
        },
        refreshedAt: new Date().toISOString(),
      });

      return { success: true };
    } finally {
      // Close the tab if we opened it
      if (shouldCloseTab) {
        try {
          await chrome.tabs.remove(tabId);
        } catch (e) {
          // Tab might already be closed
        }
      }
    }
  } catch (error) {
    console.error('[Snapshot] Failed to update snapshot:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Handle messages from popup/options/manager
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept messages from this extension (defense-in-depth)
  if (sender.id !== chrome.runtime.id) {
    return;
  }

  if (!message || typeof message.type !== 'string') {
    return;
  }

  if (message.type === 'SAVE_BOOKMARK') {
    (async () => {
      try {
        const { tabId, url, folderId, snapshotLevel } = message;
        const result = await saveBookmark(tabId, url, folderId, snapshotLevel);
        sendResponse(result);
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'GET_BOOKMARKS') {
    (async () => {
      try {
        const bookmarks = await bookmarkService.getAll();
        sendResponse({ success: true, data: bookmarks });
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message, data: [] });
      }
    })();
    return true;
  }

  if (message.type === 'GET_BOOKMARK_COUNT') {
    (async () => {
      try {
        const count = await bookmarkService.getCount();
        sendResponse({ success: true, data: count });
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message, data: 0 });
      }
    })();
    return true;
  }

  if (message.type === 'PERFORM_HEALTH_CHECK') {
    (async () => {
      try {
        const results = await performHealthCheck();
        sendResponse({ success: true, results });
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'OPEN_MANAGER') {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/index.html') });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: (error as Error).message });
    }
    return true;
  }

  if (message.type === 'OPEN_OPTIONS') {
    try {
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: (error as Error).message });
    }
    return true;
  }

  if (message.type === 'ENRICH_BOOKMARK') {
    (async () => {
      try {
        await initializeDatabase();
        const { bookmarkId } = message;
        const bookmark = await bookmarkService.getById(bookmarkId);
        if (!bookmark) {
          sendResponse({ success: false, error: 'Bookmark not found' });
          return;
        }

        const isConfigured = await aiService.isConfigured();
        if (!isConfigured) {
          sendResponse({ success: false, error: await getAiNotConfiguredError() });
          return;
        }

        const text = bookmark.content.text || bookmark.title;
        if (text.length < 10) {
          sendResponse({ success: false, error: 'Content too short for AI analysis' });
          return;
        }

        const aiResult = await aiService.generateSummary(text, bookmark.title);
        await bookmarkService.update(bookmarkId, {
          summary: aiResult.summary,
          tags: aiResult.tags,
          refreshedAt: new Date().toISOString(),
        });

        const updated = await bookmarkService.getById(bookmarkId);
        sendResponse({ success: true, bookmark: updated });
      } catch (error) {
        console.error('[EnrichBookmark] Failed:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'TRANSLATE_CONTENT') {
    (async () => {
      try {
        await initializeDatabase();
        const { bookmarkId, text, targetLanguage, field } = message;

        const isConfigured = await aiService.isConfigured();
        if (!isConfigured) {
          sendResponse({ success: false, error: await getAiNotConfiguredError() });
          return;
        }

        if (!text || text.length < 5) {
          sendResponse({ success: false, error: 'Text too short' });
          return;
        }

        const translatedText = await aiService.translateText(text, targetLanguage);

        // Cache translation in bookmark
        if (bookmarkId && field) {
          try {
            const bookmark = await bookmarkService.getById(bookmarkId);
            if (bookmark) {
              const translations = bookmark.translations || {};
              const fieldCache = translations[field as 'summary' | 'content'] || {};
              fieldCache[targetLanguage] = translatedText;
              translations[field as 'summary' | 'content'] = fieldCache;
              await bookmarkService.update(bookmarkId, { translations });
            }
          } catch {
            // Cache write failure is non-fatal
          }
        }

        sendResponse({ success: true, translatedText });
      } catch (error) {
        console.error('[TranslateContent] Failed:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'UPDATE_SNAPSHOT') {
    (async () => {
      try {
        const { bookmarkId, level } = message;
        const result = await updateSnapshot(bookmarkId, level);
        sendResponse(result);
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'REGENERATE_SUMMARY') {
    (async () => {
      try {
        const { bookmarkId } = message;
        const bookmark = await bookmarkService.getById(bookmarkId);
        if (!bookmark) {
          sendResponse({ success: false, error: 'Bookmark not found' });
          return;
        }

        // Use content if available, otherwise use title
        const textInput = bookmark.content.text && bookmark.content.text.length > 10
          ? bookmark.content.text
          : bookmark.title;

        const isConfigured = await aiService.isConfigured();
        if (!isConfigured) {
          sendResponse({ success: false, error: await getAiNotConfiguredError() });
          return;
        }
        if (textInput.length < 5) {
          sendResponse({ success: false, error: 'Content too short' });
          return;
        }

        const aiResult = await aiService.generateSummary(textInput, bookmark.title);
        await bookmarkService.update(bookmarkId, {
          summary: aiResult.summary,
          tags: aiResult.tags,
        });

        sendResponse({
          success: true,
          summary: aiResult.summary,
          tags: aiResult.tags,
        });
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'LOOKUP_DOMAIN_INTELLIGENCE') {
    (async () => {
      try {
        const { domain } = message;
        if (!domain) {
          sendResponse({ success: false, error: 'Domain required' });
          return;
        }
        const domainInfo = await lookupRDAP(domain);
        sendResponse({ success: true, data: domainInfo });
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }
});

// ===== Real-Time Navigation Safety Check =====

// Track tabs currently being checked to avoid double-checks
const pendingChecks = new Set<number>();

// Listen for tab navigation and check domain safety
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // Only check main frame navigations (not iframes)
  if (details.frameId !== 0) return;

  // Skip non-navigation events (back/forward, reload)
  if (details.transitionType === 'reload' || details.transitionType === 'auto_subframe') return;

  const { tabId, url } = details;

  // Skip if already checking this tab
  if (pendingChecks.has(tabId)) return;
  pendingChecks.add(tabId);

  try {
    const settings = await storageService.getSettings();

    // Require login — don't activate for anonymous users
    if (!settings.userId || !settings.userToken) return;

    // Check if user has safety check enabled
    if (settings.realtimeProtection === false) return;

    // Check safety via backend API
    const result = await checkUrlSafety(url);
    if (!result) return;

    // Only warn on dangerous/suspicious results
    if (!shouldWarn(result)) return;

    // Check user's persistent whitelist
    const whitelisted = await isDomainWhitelisted(result.domain);
    if (whitelisted) return;

    // Check if user has already bypassed this domain in this session
    const bypassed = await isDomainBypassed(result.domain);
    if (bypassed) return;

    // Redirect to warning page
    const warningUrl = buildWarningUrl(url, result);
    chrome.tabs.update(tabId, { url: warningUrl });
  } catch (error) {
    // Fail open — never block navigation due to errors
    console.error('[SafetyCheck] Error:', error);
  } finally {
    pendingChecks.delete(tabId);
  }
});

// Export for testing
export { saveBookmark, performHealthCheck };
