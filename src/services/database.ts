import Dexie, { type EntityTable } from 'dexie';
import type { Bookmark, Folder } from '../types';
import { DEFAULT_FOLDERS } from '../types/folder';
import { extractDomain } from '../utils/url';
import { embeddingService } from './embedding';

class SmartBookmarksDB extends Dexie {
  bookmarks!: EntityTable<Bookmark, 'id'>;
  folders!: EntityTable<Folder, 'id'>;

  constructor() {
    super('SmartBookmarksDB');

    this.version(1).stores({
      bookmarks: 'id, url, normalizedUrl, folderId, status, createdAt, refreshedAt, *tags',
      folders: 'id, parentId, order',
    });

    // Add domain index for same-site queries
    this.version(2).stores({
      bookmarks: 'id, url, normalizedUrl, domain, folderId, status, createdAt, refreshedAt, *tags',
      folders: 'id, parentId, order',
    });

    // Add riskLevel index for fraud filtering
    this.version(3).stores({
      bookmarks: 'id, url, normalizedUrl, domain, folderId, status, riskLevel, createdAt, refreshedAt, *tags',
      folders: 'id, parentId, order',
    });
  }
}

export const db = new SmartBookmarksDB();

// Initialize default folders
export async function initializeDatabase(): Promise<void> {
  const folderCount = await db.folders.count();
  if (folderCount === 0) {
    const now = new Date().toISOString();
    const folders: Folder[] = DEFAULT_FOLDERS.map(f => ({
      ...f,
      createdAt: now,
    }));
    await db.folders.bulkAdd(folders);
  }
}

// Bookmark operations
export const bookmarkService = {
  async create(bookmark: Bookmark): Promise<string> {
    return await db.bookmarks.add(bookmark);
  },

  async update(id: string, changes: Partial<Bookmark>): Promise<void> {
    await db.bookmarks.update(id, changes);
  },

  async delete(id: string): Promise<void> {
    await db.bookmarks.delete(id);
  },

  async getById(id: string): Promise<Bookmark | undefined> {
    return await db.bookmarks.get(id);
  },

  async getByUrl(url: string): Promise<Bookmark | undefined> {
    return await db.bookmarks.where('url').equals(url).first();
  },

  async getByNormalizedUrl(normalizedUrl: string): Promise<Bookmark | undefined> {
    return await db.bookmarks.where('normalizedUrl').equals(normalizedUrl).first();
  },

  async getAll(): Promise<Bookmark[]> {
    return await db.bookmarks.orderBy('createdAt').reverse().toArray();
  },

  async getByFolder(folderId: string): Promise<Bookmark[]> {
    if (folderId === 'all') {
      return this.getAll();
    }
    const results = await db.bookmarks
      .where('folderId')
      .equals(folderId)
      .toArray();
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async search(query: string): Promise<Bookmark[]> {
    const lowerQuery = query.toLowerCase();
    const allBookmarks = await this.getAll();
    return allBookmarks.filter(b =>
      (b.title || '').toLowerCase().includes(lowerQuery) ||
      (b.summary || '').toLowerCase().includes(lowerQuery) ||
      (b.tags || []).some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      (b.url || '').toLowerCase().includes(lowerQuery)
    );
  },

  async getCount(): Promise<number> {
    return await db.bookmarks.count();
  },

  async getCountByFolder(folderId: string): Promise<number> {
    if (folderId === 'all') {
      return this.getCount();
    }
    return await db.bookmarks.where('folderId').equals(folderId).count();
  },

  async updateStatus(id: string, status: Bookmark['status']): Promise<void> {
    await db.bookmarks.update(id, {
      status,
      lastCheckedAt: new Date().toISOString(),
    });
  },

  async bulkUpdateStatus(ids: string[], status: Bookmark['status']): Promise<void> {
    const now = new Date().toISOString();
    await db.bookmarks.bulkUpdate(
      ids.map(id => ({
        key: id,
        changes: { status, lastCheckedAt: now },
      }))
    );
  },

  async updateLastVisited(id: string): Promise<void> {
    await db.bookmarks.update(id, {
      lastVisitedAt: new Date().toISOString(),
    });
  },

  async getByDomain(domain: string): Promise<Bookmark[]> {
    const results = await db.bookmarks
      .where('domain')
      .equals(domain)
      .toArray();
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getCountByDomain(domain: string): Promise<number> {
    return await db.bookmarks.where('domain').equals(domain).count();
  },

  async bulkDelete(ids: string[]): Promise<void> {
    await db.bookmarks.bulkDelete(ids);
  },

  async semanticSearch(query: string, limit = 20): Promise<Bookmark[]> {
    try {
      const results = await embeddingService.searchSimilar(query, limit);
      if (results.length === 0) return [];

      const ids = results.map(r => r.bookmarkId);
      const scoreMap = new Map(results.map(r => [r.bookmarkId, r.score]));

      const bookmarks = await db.bookmarks
        .where('id')
        .anyOf(ids)
        .toArray();

      // Attach score and sort by similarity
      return bookmarks
        .map(b => ({ ...b, similarityScore: scoreMap.get(b.id) || 0 }))
        .sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
    } catch (error) {
      console.error('Semantic search failed, falling back to keyword search:', error);
      return this.search(query);
    }
  },

  async getDomainCounts(): Promise<Map<string, number>> {
    const bookmarks = await db.bookmarks.toArray();
    const counts = new Map<string, number>();
    bookmarks.forEach(b => {
      // Use domain field if available, otherwise extract from URL
      const domain = b.domain || extractDomain(b.url);
      if (domain) {
        const count = counts.get(domain) || 0;
        counts.set(domain, count + 1);
      }
    });
    return counts;
  },
};

// Folder operations
export const folderService = {
  async create(folder: Folder): Promise<string> {
    return await db.folders.add(folder);
  },

  async update(id: string, changes: Partial<Folder>): Promise<void> {
    await db.folders.update(id, changes);
  },

  async delete(id: string): Promise<void> {
    // Move bookmarks to 'all' folder before deleting
    await db.bookmarks.where('folderId').equals(id).modify({ folderId: 'all' });
    // Delete child folders
    const children = await db.folders.where('parentId').equals(id).toArray();
    for (const child of children) {
      await this.delete(child.id);
    }
    await db.folders.delete(id);
  },

  async getById(id: string): Promise<Folder | undefined> {
    return await db.folders.get(id);
  },

  async getAll(): Promise<Folder[]> {
    return await db.folders.orderBy('order').toArray();
  },

  async getChildren(parentId: string | null): Promise<Folder[]> {
    if (parentId === null) {
      // Root folders have parentId as null or empty string
      const allFolders = await db.folders.toArray();
      return allFolders.filter(f => !f.parentId);
    }
    return await db.folders.where('parentId').equals(parentId).toArray();
  },

  async getWithCounts(): Promise<(Folder & { count: number })[]> {
    const folders = await this.getAll();
    // Single query to get all folder counts - avoids N+1 problem
    const bookmarks = await db.bookmarks.toArray();
    const folderCounts = new Map<string, number>();

    // Count bookmarks per folder in memory
    for (const bookmark of bookmarks) {
      const folderId = bookmark.folderId || 'all';
      folderCounts.set(folderId, (folderCounts.get(folderId) || 0) + 1);
    }

    const totalCount = bookmarks.length;

    return folders.map(f => ({
      ...f,
      count: f.id === 'all' ? totalCount : (folderCounts.get(f.id) || 0),
    }));
  },

  // Bulk update folders - atomic operation to prevent race conditions
  async bulkUpdate(updates: { id: string; changes: Partial<Folder> }[]): Promise<void> {
    await db.transaction('rw', db.folders, async () => {
      for (const { id, changes } of updates) {
        await db.folders.update(id, changes);
      }
    });
  },
};

export default db;
