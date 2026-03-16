export interface Folder {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  order: number;
  createdAt: string;
}

export interface FolderWithChildren extends Folder {
  children?: FolderWithChildren[];
  count?: number;
}

export const DEFAULT_FOLDERS: Omit<Folder, 'createdAt'>[] = [
  { id: 'all', name: 'All Bookmarks', icon: 'folder-open', parentId: null, order: 0 },
];
