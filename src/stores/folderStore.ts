import { create } from 'zustand';
import { folderService } from '../services/database';
import type { Folder, FolderWithChildren } from '../types';

interface FolderState {
  folders: Folder[];
  foldersWithCounts: (Folder & { count: number })[];
  selectedFolderId: string;
  expandedFolders: Set<string>;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadFolders: () => Promise<void>;
  selectFolder: (id: string) => void;
  toggleFolder: (id: string) => void;
  createFolder: (name: string, icon: string, parentId?: string) => Promise<void>;
  updateFolder: (id: string, changes: Partial<Folder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  reorderFolder: (folderId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => Promise<void>;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  foldersWithCounts: [],
  selectedFolderId: 'all',
  expandedFolders: new Set<string>(),
  isLoading: false,
  error: null,

  loadFolders: async () => {
    set({ isLoading: true, error: null });
    try {
      let folders = await folderService.getAll();

      // Ensure "all" folder stays at top root and is non-movable
      const allFolder = folders.find(f => f.id === 'all');
      if (allFolder && (allFolder.parentId !== null || allFolder.order !== -1)) {
        await folderService.update('all', { parentId: null, order: -1 });
        folders = await folderService.getAll();
      }
      const foldersWithCounts = await folderService.getWithCounts();

      // Auto-expand all folders that have children
      const parentIds = new Set<string>();
      folders.forEach(f => {
        if (f.parentId) {
          parentIds.add(f.parentId);
        }
      });

      set({
        folders,
        foldersWithCounts,
        isLoading: false,
        expandedFolders: parentIds,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  selectFolder: (id: string) => {
    set({ selectedFolderId: id });
  },

  toggleFolder: (id: string) => {
    const expanded = new Set(get().expandedFolders);
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    set({ expandedFolders: expanded });
  },

  createFolder: async (name: string, icon: string, parentId?: string) => {
    try {
      const folders = get().folders;
      const targetParentId = parentId || null;

      // Check for duplicate name at the same level
      const siblings = folders.filter(f => f.parentId === targetParentId);
      const isDuplicate = siblings.some(f => f.name.toLowerCase() === name.toLowerCase());

      if (isDuplicate) {
        throw new Error('DUPLICATE_FOLDER_NAME');
      }

      const maxOrder = Math.max(...folders.map((f) => f.order), 0);
      const folder: Folder = {
        id: `folder-${Date.now()}`,
        name,
        icon,
        parentId: targetParentId,
        order: maxOrder + 1,
        createdAt: new Date().toISOString(),
      };
      await folderService.create(folder);
      await get().loadFolders();
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updateFolder: async (id: string, changes: Partial<Folder>) => {
    try {
      await folderService.update(id, changes);
      await get().loadFolders();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteFolder: async (id: string) => {
    try {
      await folderService.delete(id);
      if (get().selectedFolderId === id) {
        set({ selectedFolderId: 'all' });
      }
      await get().loadFolders();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  reorderFolder: async (folderId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => {
    try {
      if (folderId === 'all') return;
      const folders = get().folders;
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;

      // Collect all updates to apply atomically
      const updates: { id: string; changes: Partial<Folder> }[] = [];

      // Determine new parentId and order
      let newParentId: string | null = null;
      let newOrder: number;

      if (position === 'inside' && targetId) {
        // Move inside target folder
        newParentId = targetId;
        const siblings = folders.filter(f => f.parentId === targetId);
        newOrder = siblings.length > 0 ? Math.max(...siblings.map(f => f.order)) + 1 : 0;
      } else if (targetId) {
        // Move before or after target
        const target = folders.find(f => f.id === targetId);
        if (!target) return;
        newParentId = target.parentId;
        const siblings = folders.filter(f => f.parentId === newParentId && f.id !== folderId);

        if (position === 'before') {
          newOrder = target.order;
          // Shift all siblings with order >= target.order
          for (const sibling of siblings) {
            if (sibling.order >= target.order) {
              updates.push({ id: sibling.id, changes: { order: sibling.order + 1 } });
            }
          }
        } else {
          newOrder = target.order + 1;
          // Shift all siblings with order > target.order
          for (const sibling of siblings) {
            if (sibling.order > target.order) {
              updates.push({ id: sibling.id, changes: { order: sibling.order + 1 } });
            }
          }
        }
      } else {
        // Move to root level at the end
        newParentId = null;
        const rootFolders = folders.filter(f => !f.parentId && f.id !== folderId);
        newOrder = rootFolders.length > 0 ? Math.max(...rootFolders.map(f => f.order)) + 1 : 0;
      }

      // Add the main folder update
      updates.push({ id: folderId, changes: { parentId: newParentId, order: newOrder } });

      // Apply all updates atomically using bulkUpdate
      await folderService.bulkUpdate(updates);
      await get().loadFolders();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));

// Helper function to build folder tree
export function buildFolderTree(folders: (Folder & { count: number })[]): FolderWithChildren[] {
  const folderMap = new Map<string, FolderWithChildren>();

  // First pass: create map
  folders.forEach((folder) => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });

  // Second pass: build tree
  const rootFolders: FolderWithChildren[] = [];

  folders.forEach((folder) => {
    const node = folderMap.get(folder.id)!;
    if (folder.parentId && folderMap.has(folder.parentId)) {
      const parent = folderMap.get(folder.parentId)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      rootFolders.push(node);
    }
  });

  // Sort by order
  const sortByOrder = (items: FolderWithChildren[]) => {
    items.sort((a, b) => {
      if (a.id === 'all') return -1;
      if (b.id === 'all') return 1;
      return a.order - b.order;
    });
    items.forEach((item) => {
      if (item.children) {
        sortByOrder(item.children);
      }
    });
  };

  sortByOrder(rootFolders);

  return rootFolders;
}
