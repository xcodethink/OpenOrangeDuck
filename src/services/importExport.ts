import { bookmarkService, folderService } from './database';
import type { Bookmark, Folder } from '../types';
import { normalizeUrl, extractDomain } from '../utils/url';

// Chrome bookmark tree node type
interface ChromeBookmarkNode {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: ChromeBookmarkNode[];
}

interface ExportData {
  version: string;
  exportedAt: string;
  bookmarks: Bookmark[];
  folders: Folder[];
}

export async function importChromeBookmarks(): Promise<{ imported: number; skipped: number }> {
  const hasPermission = await chrome.permissions.request({ permissions: ['bookmarks'] });
  if (!hasPermission) {
    throw new Error('Bookmarks permission denied');
  }

  return new Promise((resolve, reject) => {
    if (!chrome?.bookmarks) {
      reject(new Error('Chrome Bookmarks API not available'));
      return;
    }

    chrome.bookmarks.getTree(async (tree) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      let imported = 0;
      let skipped = 0;

      // Pre-load existing bookmarks ONCE to avoid N+1 queries
      const existing = await bookmarkService.getAll();
      const existingUrls = new Set(existing.map(b => b.normalizedUrl));

      async function processNode(node: ChromeBookmarkNode, folderId: string) {
        if (node.url) {
          try {
            const normalizedUrl = normalizeUrl(node.url);

            // O(1) lookup using Set
            if (existingUrls.has(normalizedUrl)) {
              skipped++;
              return;
            }

            const now = new Date().toISOString();
            const bookmark: Bookmark = {
              id: crypto.randomUUID(),
              url: node.url,
              normalizedUrl,
              domain: extractDomain(node.url),
              title: node.title || 'Untitled',
              favicon: safeFaviconUrl(node.url),
              summary: '',
              tags: [],
              content: { text: '' },
              snapshot: { level: 'L1', size: '0 KB', createdAt: now },
              status: 'healthy',
              folderId,
              createdAt: node.dateAdded ? new Date(node.dateAdded).toISOString() : now,
              refreshedAt: now,
            };

            await bookmarkService.create(bookmark);
            existingUrls.add(normalizedUrl); // Track newly added
            imported++;
          } catch (e) {
            console.error('Failed to import bookmark:', node.url, e);
            skipped++;
          }
        } else if (node.children) {
          let targetFolderId = folderId;
          if (node.title && node.title !== 'Bookmarks Bar' && node.title !== 'Other Bookmarks') {
            const newFolder: Folder = {
              id: crypto.randomUUID(),
              name: node.title,
              icon: 'folder',
              parentId: folderId === 'all' ? null : folderId,
              order: 0,
              createdAt: new Date().toISOString(),
            };
            await folderService.create(newFolder);
            targetFolderId = newFolder.id;
          }

          for (const child of node.children) {
            await processNode(child, targetFolderId);
          }
        }
      }

      try {
        for (const root of tree) {
          if (root.children) {
            for (const child of root.children) {
              await processNode(child, 'all');
            }
          }
        }
        resolve({ imported, skipped });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function importFromHTML(htmlContent: string): Promise<{ imported: number; skipped: number }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  let imported = 0;
  let skipped = 0;

  const existing = await bookmarkService.getAll();
  const existingUrls = new Set(existing.map(b => b.normalizedUrl));

  // Chrome/Safari/Firefox export uses NETSCAPE bookmark format:
  // <DL> = folder contents, <DT><H3> = folder name, <DT><A> = bookmark
  async function processDL(dl: Element, parentFolderId: string) {
    let folderOrder = 0;
    for (const dt of Array.from(dl.children)) {
      if (dt.tagName !== 'DT') continue;

      const h3 = dt.querySelector(':scope > H3');
      const a = dt.querySelector(':scope > A');

      if (h3) {
        // This DT is a folder — find its content <DL>
        const folderName = h3.textContent?.trim() || 'Untitled Folder';

        // Skip browser system folders, use their contents directly
        const systemFolders = ['Bookmarks Bar', 'Other Bookmarks', 'Favorites', 'Bookmarks Menu',
          '书签栏', '其他书签', 'Barre de favoris', 'Autres favoris', 'Lesezeichenleiste',
          'Weitere Lesezeichen', 'Barra de marcadores', 'Otros marcadores'];
        const isSystem = systemFolders.includes(folderName);

        let targetFolderId = parentFolderId;
        if (!isSystem) {
          const newFolder: Folder = {
            id: crypto.randomUUID(),
            name: folderName,
            icon: 'folder',
            parentId: parentFolderId === 'all' ? null : parentFolderId,
            order: folderOrder++,
            createdAt: new Date().toISOString(),
          };
          await folderService.create(newFolder);
          targetFolderId = newFolder.id;
        }

        // Find the sibling <DL> that follows the <H3>
        const childDL = dt.querySelector(':scope > DL');
        if (childDL) {
          await processDL(childDL, targetFolderId);
        }
      } else if (a) {
        // This DT is a bookmark
        const url = a.getAttribute('href');
        if (!url || url.startsWith('javascript:')) continue;

        try {
          const normalizedUrl = normalizeUrl(url);
          if (existingUrls.has(normalizedUrl)) {
            skipped++;
            continue;
          }

          const addDate = a.getAttribute('ADD_DATE');
          const now = new Date().toISOString();
          const bookmark: Bookmark = {
            id: crypto.randomUUID(),
            url,
            normalizedUrl,
            domain: extractDomain(url),
            title: a.textContent?.trim() || 'Untitled',
            favicon: safeFaviconUrl(url),
            summary: '',
            tags: [],
            content: { text: '' },
            snapshot: { level: 'L1', size: '0 KB', createdAt: now },
            status: 'healthy',
            folderId: parentFolderId,
            createdAt: addDate ? new Date(parseInt(addDate) * 1000).toISOString() : now,
            refreshedAt: now,
          };

          await bookmarkService.create(bookmark);
          existingUrls.add(normalizedUrl);
          imported++;
        } catch (e) {
          console.error('Failed to import:', url, e);
          skipped++;
        }
      }
    }
  }

  // Find the root <DL> element
  const rootDL = doc.querySelector('DL');
  if (rootDL) {
    await processDL(rootDL, 'all');
  }

  return { imported, skipped };
}

export async function importFromJSON(jsonContent: string): Promise<{ imported: number; skipped: number }> {
  let data: ExportData;
  try {
    data = JSON.parse(jsonContent);
  } catch {
    throw new Error('Invalid JSON format');
  }

  if (!data.version || !data.bookmarks) {
    throw new Error('Invalid export file format');
  }

  let imported = 0;
  let skipped = 0;

  const existing = await bookmarkService.getAll();
  const existingUrls = new Set(existing.map(b => b.normalizedUrl));

  if (data.folders) {
    for (const folder of data.folders) {
      try {
        const now = new Date().toISOString();
        await folderService.create({
          ...folder,
          id: crypto.randomUUID(),
          createdAt: folder.createdAt || now,
        });
      } catch (e) {
        console.error('Failed to import folder:', folder.name, e);
      }
    }
  }

  for (const bookmark of data.bookmarks) {
    if (existingUrls.has(bookmark.normalizedUrl)) {
      skipped++;
      continue;
    }

    try {
      await bookmarkService.create({
        ...bookmark,
        id: crypto.randomUUID(),
        folderId: 'all',
      });
      existingUrls.add(bookmark.normalizedUrl);
      imported++;
    } catch (e) {
      console.error('Failed to import bookmark:', bookmark.url, e);
      skipped++;
    }
  }

  return { imported, skipped };
}

export async function exportToJSON(): Promise<string> {
  const bookmarks = await bookmarkService.getAll();
  const folders = await folderService.getAll();

  const exportData: ExportData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    bookmarks,
    folders,
  };

  return JSON.stringify(exportData, null, 2);
}

export async function exportToHTML(): Promise<string> {
  const bookmarks = await bookmarkService.getAll();
  const folders = await folderService.getAll();

  const folderMap = new Map(folders.map(f => [f.id, f]));

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>OrangeDuck Export</TITLE>
<H1>OrangeDuck</H1>
<DL><p>
`;

  const bookmarksByFolder = new Map<string, Bookmark[]>();
  for (const bookmark of bookmarks) {
    const folderId = bookmark.folderId || 'all';
    if (!bookmarksByFolder.has(folderId)) {
      bookmarksByFolder.set(folderId, []);
    }
    bookmarksByFolder.get(folderId)!.push(bookmark);
  }

  for (const [folderId, folderBookmarks] of bookmarksByFolder) {
    const folder = folderMap.get(folderId);
    const folderName = folder?.name || 'All Bookmarks';

    html += `    <DT><H3>${escapeHtml(folderName)}</H3>\n    <DL><p>\n`;

    for (const bookmark of folderBookmarks) {
      const addDate = Math.floor(new Date(bookmark.createdAt).getTime() / 1000);
      html += `        <DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${addDate}">${escapeHtml(bookmark.title)}</A>\n`;
    }

    html += `    </DL><p>\n`;
  }

  html += `</DL><p>`;

  return html;
}

function safeFaviconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
