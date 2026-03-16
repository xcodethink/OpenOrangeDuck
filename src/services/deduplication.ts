import { db, bookmarkService } from './database';
import { normalizeUrl } from '../utils/url';
import { calculateSimilarity } from '../utils/similarity';
import type { Bookmark, BookmarkSimilarity } from '../types';

export interface DuplicateGroup {
  type: 'same_url' | 'same_domain' | 'similar_content';
  label: string;
  icon: string;
  items: DuplicateItem[];
}

export interface DuplicateItem {
  bookmark: Bookmark;
  similarity?: number;
}

const SIMILARITY_THRESHOLD = 0.85; // 85% similarity threshold

// Known two-part TLDs where the brand is one level above
const TWO_PART_TLDS = new Set([
  'com.hk', 'com.sg', 'com.vn', 'com.tw', 'com.cn', 'com.my',
  'com.au', 'com.br', 'com.mx', 'com.ar', 'com.co', 'com.ph',
  'com.pk', 'com.ng', 'com.eg', 'com.sa', 'com.tr', 'com.ua',
  'co.uk', 'co.jp', 'co.kr', 'co.in', 'co.id', 'co.th', 'co.nz', 'co.za',
  'org.uk', 'org.au', 'net.au', 'ac.uk', 'gov.uk',
]);

/**
 * Extract the "brand" name from a domain.
 * e.g. hsbc.com.hk → hsbc, docs.google.com → google, github.com → github
 */
export function extractBrand(domain: string): string {
  const parts = domain.split('.');
  if (parts.length < 2) return domain;

  // Check for two-part TLD
  if (parts.length >= 3) {
    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (TWO_PART_TLDS.has(lastTwo)) {
      // Brand is the part before the two-part TLD
      return parts[parts.length - 3];
    }
  }

  // Standard TLD: brand is second-to-last
  return parts[parts.length - 2];
}

export const deduplicationService = {
  // Check if a URL already exists (normalized)
  async checkDuplicateUrl(url: string): Promise<Bookmark | null> {
    const normalized = normalizeUrl(url);
    const existing = await bookmarkService.getByNormalizedUrl(normalized);
    return existing || null;
  },

  // Find similar bookmarks by content (accepts pre-loaded bookmarks to avoid N+1)
  findSimilarBookmarksFromList(
    content: string,
    bookmarks: Bookmark[],
    excludeId?: string
  ): { bookmark: Bookmark; similarity: number }[] {
    const similar: { bookmark: Bookmark; similarity: number }[] = [];

    for (const bookmark of bookmarks) {
      if (bookmark.id === excludeId) continue;
      if (!bookmark.content?.text) continue;

      const similarity = calculateSimilarity(content, bookmark.content.text);
      if (similarity >= SIMILARITY_THRESHOLD) {
        similar.push({ bookmark, similarity });
      }
    }

    return similar.sort((a, b) => b.similarity - a.similarity);
  },

  // Find similar bookmarks by content (loads from DB - use sparingly)
  async findSimilarBookmarks(content: string, excludeId?: string): Promise<{ bookmark: Bookmark; similarity: number }[]> {
    const allBookmarks = await bookmarkService.getAll();
    return this.findSimilarBookmarksFromList(content, allBookmarks, excludeId);
  },

  // Update bookmark with similarity info
  async updateSimilarity(
    bookmarkId: string,
    similarityInfo: BookmarkSimilarity | undefined
  ): Promise<void> {
    await db.bookmarks.update(bookmarkId, { similarity: similarityInfo });
  },

  // Step 1: Find exact URL duplicates
  getExactDuplicates(allBookmarks: Bookmark[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const urlGroups = new Map<string, Bookmark[]>();

    for (const bookmark of allBookmarks) {
      const normalized = bookmark.normalizedUrl;
      const existing = urlGroups.get(normalized) || [];
      existing.push(bookmark);
      urlGroups.set(normalized, existing);
    }

    for (const [, bookmarks] of urlGroups) {
      if (bookmarks.length > 1) {
        groups.push({
          type: 'same_url',
          label: 'Exact Same URL',
          icon: 'link',
          items: bookmarks.map(b => ({ bookmark: b })),
        });
      }
    }

    return groups;
  },

  // Step 2: Find content similarity duplicates
  getSimilarContent(allBookmarks: Bookmark[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    for (const bookmark of allBookmarks) {
      if (processed.has(bookmark.id)) continue;
      if (!bookmark.content?.text) continue;

      const similar = this.findSimilarBookmarksFromList(
        bookmark.content.text,
        allBookmarks,
        bookmark.id
      );

      if (similar.length > 0) {
        groups.push({
          type: 'similar_content',
          label: 'Similar Content',
          icon: 'file-text',
          items: [
            { bookmark, similarity: 1 },
            ...similar.map(s => ({
              bookmark: s.bookmark,
              similarity: s.similarity,
            })),
          ],
        });

        processed.add(bookmark.id);
        similar.forEach(s => processed.add(s.bookmark.id));
      }
    }

    return groups;
  },

  // Step 3: Find domain families (related sites from same brand/org)
  getDomainFamilies(allBookmarks: Bookmark[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];

    // Group bookmarks by brand
    const brandMap = new Map<string, Map<string, Bookmark[]>>();
    for (const bookmark of allBookmarks) {
      if (!bookmark.domain) continue;
      const brand = extractBrand(bookmark.domain);
      if (!brand || brand.length < 2) continue; // skip single-char brands

      if (!brandMap.has(brand)) {
        brandMap.set(brand, new Map());
      }
      const domainMap = brandMap.get(brand)!;
      const existing = domainMap.get(bookmark.domain) || [];
      existing.push(bookmark);
      domainMap.set(bookmark.domain, existing);
    }

    // Filter for brands with 2+ distinct domains
    for (const [brand, domainMap] of brandMap) {
      if (domainMap.size < 2) continue;

      // Collect all bookmarks from this brand, grouped by domain
      const items: DuplicateItem[] = [];
      for (const [, bookmarks] of domainMap) {
        for (const bookmark of bookmarks) {
          items.push({ bookmark });
        }
      }

      groups.push({
        type: 'same_domain',
        label: brand.charAt(0).toUpperCase() + brand.slice(1),
        icon: 'globe',
        items,
      });
    }

    return groups;
  },

  // Get all duplicate groups for deduplication UI (aggregated)
  async getDuplicateGroups(): Promise<DuplicateGroup[]> {
    const allBookmarks = await bookmarkService.getAll();
    return [
      ...this.getExactDuplicates(allBookmarks),
      ...this.getSimilarContent(allBookmarks),
      ...this.getDomainFamilies(allBookmarks),
    ];
  },

  // Load all bookmarks (exposed for step-by-step UI)
  async loadAllBookmarks(): Promise<Bookmark[]> {
    return await bookmarkService.getAll();
  },

  // Merge bookmarks (keep first, delete rest)
  async mergeBookmarks(keepId: string, deleteIds: string[]): Promise<void> {
    for (const id of deleteIds) {
      if (id !== keepId) {
        await bookmarkService.delete(id);
      }
    }
  },
};

export default deduplicationService;
