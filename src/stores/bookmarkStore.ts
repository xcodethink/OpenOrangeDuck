import { create } from 'zustand';
import { bookmarkService } from '../services/database';
import type { Bookmark, BookmarkStatus } from '../types';

interface BookmarkState {
  bookmarks: Bookmark[];
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
  domainCounts: Map<string, number>;
  isSemanticMode: boolean;

  // Actions
  loadBookmarks: () => Promise<void>;
  loadAll: () => Promise<void>; // Alias for loadBookmarks
  loadByFolder: (folderId: string) => Promise<void>;
  loadByDomain: (domain: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  selectBookmark: (id: string | null) => void;
  updateStatus: (id: string, status: BookmarkStatus) => Promise<void>;
  updateLastVisited: (id: string) => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  refreshBookmarks: () => Promise<void>;
  loadDomainCounts: () => Promise<void>;
  moveToFolder: (bookmarkId: string, folderId: string) => Promise<void>;
  setSemanticMode: (enabled: boolean) => void;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  selectedId: null,
  isLoading: false,
  error: null,
  domainCounts: new Map(),
  isSemanticMode: true,

  loadBookmarks: async () => {
    set({ isLoading: true, error: null });
    try {
      const bookmarks = await bookmarkService.getAll();
      set({ bookmarks, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const bookmarks = await bookmarkService.getAll();
      set({ bookmarks, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadByFolder: async (folderId: string) => {
    set({ isLoading: true, error: null });
    try {
      const bookmarks = await bookmarkService.getByFolder(folderId);
      set({ bookmarks, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadByDomain: async (domain: string) => {
    set({ isLoading: true, error: null });
    try {
      const bookmarks = await bookmarkService.getByDomain(domain);
      set({ bookmarks, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  search: async (query: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!query.trim()) {
        const bookmarks = await bookmarkService.getAll();
        set({ bookmarks, isLoading: false });
      } else if (get().isSemanticMode) {
        const bookmarks = await bookmarkService.semanticSearch(query);
        set({ bookmarks, isLoading: false });
      } else {
        const bookmarks = await bookmarkService.search(query);
        set({ bookmarks, isLoading: false });
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  selectBookmark: (id: string | null) => {
    set({ selectedId: id });
  },

  updateStatus: async (id: string, status: BookmarkStatus) => {
    try {
      await bookmarkService.updateStatus(id, status);
      const bookmarks = get().bookmarks.map((b) =>
        b.id === id ? { ...b, status } : b
      );
      set({ bookmarks });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteBookmark: async (id: string) => {
    try {
      await bookmarkService.delete(id);
      const bookmarks = get().bookmarks.filter((b) => b.id !== id);
      const selectedId = get().selectedId === id ? null : get().selectedId;
      set({ bookmarks, selectedId });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  refreshBookmarks: async () => {
    await get().loadBookmarks();
  },

  updateLastVisited: async (id: string) => {
    try {
      await bookmarkService.updateLastVisited(id);
      const now = new Date().toISOString();
      const bookmarks = get().bookmarks.map((b) =>
        b.id === id ? { ...b, lastVisitedAt: now } : b
      );
      set({ bookmarks });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadDomainCounts: async () => {
    try {
      const domainCounts = await bookmarkService.getDomainCounts();
      set({ domainCounts });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  moveToFolder: async (bookmarkId: string, folderId: string) => {
    try {
      await bookmarkService.update(bookmarkId, { folderId });
      const bookmarks = get().bookmarks.map((b) =>
        b.id === bookmarkId ? { ...b, folderId } : b
      );
      set({ bookmarks });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  setSemanticMode: (enabled: boolean) => {
    set({ isSemanticMode: enabled });
  },
}));
