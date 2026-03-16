import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFolderStore, buildFolderTree } from '../../stores/folderStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import { toast } from '../../components/Toast';
import type { FolderWithChildren, Folder } from '../../types';
import {
  Folder as FolderIcon,
  FolderOpen,
  Briefcase,
  BookOpen,
  Target,
  Lightbulb,
  Wrench,
  Palette,
  Rocket,
  Star,
  Heart,
  Flame,
  FileText,
  Film,
  Music,
  Camera,
  ShoppingCart,
  Plane,
  Home,
  Gamepad2,
  Plus,
  Pencil,
  Keyboard,
  ChevronDown,
  ChevronRight,
  Library,
} from 'lucide-react';
import { cn } from '../../utils/cn';

type DropPosition = 'before' | 'inside' | 'after';

interface FolderItemProps {
  folder: FolderWithChildren;
  level?: number;
  isEditMode?: boolean;
  onEdit?: (folder: Folder) => void;
  onDragStart?: (folder: Folder) => void;
  onDragOver?: (e: React.DragEvent, folder: Folder, position: DropPosition) => void;
  onDrop?: (e: React.DragEvent, folder: Folder, position: DropPosition) => void;
  dragOverId?: string | null;
  dragOverPosition?: DropPosition | null;
}

// Lucide icon mapping for folders
const FOLDER_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  folder: FolderIcon,
  'folder-open': FolderOpen,
  briefcase: Briefcase,
  'book-open': BookOpen,
  target: Target,
  lightbulb: Lightbulb,
  wrench: Wrench,
  palette: Palette,
  rocket: Rocket,
  star: Star,
  heart: Heart,
  flame: Flame,
  'file-text': FileText,
  film: Film,
  music: Music,
  camera: Camera,
  'shopping-cart': ShoppingCart,
  plane: Plane,
  home: Home,
  gamepad: Gamepad2,
};

const FOLDER_ICON_KEYS = Object.keys(FOLDER_ICON_MAP);

// Helper to render folder icon
function FolderIconDisplay({ icon, className }: { icon: string; className?: string }) {
  const IconComponent = FOLDER_ICON_MAP[icon] || FolderIcon;
  return <IconComponent className={className} />;
}

function FolderItem({ folder, level = 0, isEditMode, onEdit, onDragStart, onDragOver, onDrop, dragOverId, dragOverPosition }: FolderItemProps) {
  const { selectedFolderId, selectFolder, expandedFolders, toggleFolder } = useFolderStore();
  const { loadByFolder } = useBookmarkStore();

  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;
  const isSystemFolder = folder.id === 'all';
  const isDragOver = dragOverId === folder.id;
  const isDragOverBefore = isDragOver && dragOverPosition === 'before';
  const isDragOverInside = isDragOver && dragOverPosition === 'inside';
  const isDragOverAfter = isDragOver && dragOverPosition === 'after';

  const handleClick = () => {
    if (isEditMode && !isSystemFolder) {
      onEdit?.(folder);
    } else {
      selectFolder(folder.id);
      loadByFolder(folder.id);
      if (hasChildren && !isExpanded) {
        toggleFolder(folder.id);
      }
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFolder(folder.id);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isSystemFolder) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(folder);
  };

  const getDropPosition = (e: React.DragEvent): DropPosition => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // 30% top = before, 40% middle = inside, 30% bottom = after
    if (y < height * 0.3) return 'before';
    if (y > height * 0.7) return 'after';
    return 'inside';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const position = getDropPosition(e);
    onDragOver?.(e, folder, position);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const position = getDropPosition(e);
    onDrop?.(e, folder, position);
  };

  return (
    <div>
      {/* Folder row with drop indicators */}
      <div className="relative">
        {/* Drop indicator line for "before" position */}
        {isDragOverBefore && (
          <div className="absolute -top-0.5 left-2 right-2 h-1 bg-violet-500 rounded-full pointer-events-none z-10" />
        )}
        <div
          draggable={!isSystemFolder && !isEditMode}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
            isSelected && !isEditMode
              ? 'bg-violet-600/40 text-white'
              : isEditMode && !isSystemFolder
              ? 'text-slate-300 hover:bg-amber-500/20 hover:ring-1 hover:ring-amber-500/30'
              : 'text-slate-300 hover:bg-slate-700/50'
          } ${isEditMode && isSystemFolder ? 'opacity-50 cursor-not-allowed' : ''} ${
            isDragOverInside ? 'ring-2 ring-violet-500 bg-violet-500/20' : ''
          } ${!isSystemFolder && !isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={handleClick}
        >
          {hasChildren ? (
            <button
              onClick={handleToggle}
              className="p-0.5 hover:bg-slate-600/50 rounded w-5 h-5 flex items-center justify-center"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <FolderIconDisplay icon={folder.icon} className="w-4 h-4" />
          <span className="flex-1 text-sm font-medium truncate">{folder.name}</span>
          {isEditMode && !isSystemFolder && (
            <Pencil className="w-3.5 h-3.5 text-amber-400" />
          )}
          {!isEditMode && folder.count !== undefined && (
            <span className="text-xs text-slate-500 font-mono bg-slate-800/50 px-1.5 py-0.5 rounded">
              {folder.count}
            </span>
          )}
        </div>
        {/* Drop indicator line for "after" position */}
        {isDragOverAfter && (
          <div className="absolute -bottom-0.5 left-2 right-2 h-1 bg-violet-500 rounded-full pointer-events-none z-10" />
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="mt-1">
          {folder.children!.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              isEditMode={isEditMode}
              onEdit={onEdit}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              dragOverId={dragOverId}
              dragOverPosition={dragOverPosition}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Folder Edit Modal
interface FolderEditModalProps {
  folder: Folder | null;
  onClose: () => void;
  onSave: (id: string, changes: Partial<Folder>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function FolderEditModal({ folder, onClose, onSave, onDelete }: FolderEditModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(folder?.name || '');
  const [icon, setIcon] = useState(folder?.icon || 'folder');
  const [showIcons, setShowIcons] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setIcon(folder.icon);
    }
    inputRef.current?.focus();
  }, [folder]);

  if (!folder) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await onSave(folder.id, { name: name.trim(), icon });
      toast.success(t('common.success'));
      onClose();
    } catch (error) {
      if ((error as Error).message === 'DUPLICATE_FOLDER_NAME') {
        toast.error(t('sidebar.duplicateName'));
      } else {
        toast.error(t('common.error'));
      }
    }
  };

  const handleDelete = async () => {
    if (!isDeleting) {
      setIsDeleting(true);
      return;
    }
    try {
      await onDelete(folder.id);
      toast.success(t('common.success'));
      onClose();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl p-6 w-80 shadow-xl border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">{t('sidebar.editFolder')}</h3>

        {/* Icon Selector */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
            {t('sidebar.icon')}
          </label>
          <button
            onClick={() => setShowIcons(!showIcons)}
            className="w-full p-3 bg-slate-700 rounded-lg flex items-center justify-center hover:bg-slate-600 transition-colors"
          >
            <FolderIconDisplay icon={icon} className="w-8 h-8" />
          </button>
          {showIcons && (
            <div className="mt-2 p-2 bg-slate-700 rounded-lg grid grid-cols-5 gap-2">
              {FOLDER_ICON_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setIcon(key);
                    setShowIcons(false);
                  }}
                  className={cn(
                    'p-2 rounded hover:bg-slate-600 transition-colors flex items-center justify-center',
                    icon === key ? 'bg-violet-600' : ''
                  )}
                >
                  <FolderIconDisplay icon={key} className="w-5 h-5" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Name Input */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
            {t('sidebar.folderName')}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDeleting
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-slate-700 hover:bg-red-600/20 text-red-400'
            }`}
          >
            {isDeleting ? t('sidebar.confirmDelete') : t('common.delete')}
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { t } = useTranslation();
  const { folders, foldersWithCounts, loadFolders, createFolder, updateFolder, deleteFolder, reorderFolder } = useFolderStore();
  const { moveToFolder } = useBookmarkStore();
  const [folderTree, setFolderTree] = useState<FolderWithChildren[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedFolder, setDraggedFolder] = useState<Folder | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<DropPosition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    if (foldersWithCounts.length > 0) {
      setFolderTree(buildFolderTree(foldersWithCounts));
    }
  }, [foldersWithCounts]);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await createFolder(newFolderName.trim(), 'folder');
      setNewFolderName('');
      setIsCreating(false);
      toast.success(t('common.success'));
    } catch (error) {
      if ((error as Error).message === 'DUPLICATE_FOLDER_NAME') {
        toast.error(t('sidebar.duplicateName'));
      } else {
        toast.error(t('common.error'));
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateFolder();
    } else if (e.key === 'Escape') {
      setNewFolderName('');
      setIsCreating(false);
    }
  };

  const handleEditFolder = (folder: Folder) => {
    setEditingFolder(folder);
  };

  const handleSaveFolder = async (id: string, changes: Partial<Folder>) => {
    // Check for duplicate name
    const targetFolder = folders.find(f => f.id === id);
    if (targetFolder && changes.name) {
      const siblings = folders.filter(f => f.parentId === targetFolder.parentId && f.id !== id);
      const isDuplicate = siblings.some(f => f.name.toLowerCase() === changes.name!.toLowerCase());
      if (isDuplicate) {
        throw new Error('DUPLICATE_FOLDER_NAME');
      }
    }
    await updateFolder(id, changes);
  };

  const handleDeleteFolder = async (id: string) => {
    await deleteFolder(id);
  };

  // Drag and Drop handlers
  const handleDragStart = (folder: Folder) => {
    setDraggedFolder(folder);
  };

  const handleDragOver = (e: React.DragEvent, folder: Folder, position: DropPosition) => {
    // Check for bookmark drag or folder drag
    const hasBookmark = e.dataTransfer.types.includes('application/x-bookmark-id');
    const hasFolderDrag = draggedFolder && draggedFolder.id !== folder.id;

    if ((hasBookmark || hasFolderDrag) && folder.id !== 'all') {
      setDragOverId(folder.id);
      setDragOverPosition(position);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: Folder, position: DropPosition) => {
    // Check if it's a bookmark being dropped
    const bookmarkId = e.dataTransfer.getData('application/x-bookmark-id');

    if (bookmarkId) {
      // Handle bookmark drop - always move into folder regardless of position
      if (targetFolder.id === 'all') {
        setDragOverId(null);
        setDragOverPosition(null);
        return;
      }

      try {
        await moveToFolder(bookmarkId, targetFolder.id);
        toast.success(t('common.success'));
      } catch (error) {
        toast.error(t('common.error'));
      }
      setDragOverId(null);
      setDragOverPosition(null);
      return;
    }

    // Handle folder drop
    if (!draggedFolder || draggedFolder.id === targetFolder.id || targetFolder.id === 'all') {
      setDraggedFolder(null);
      setDragOverId(null);
      setDragOverPosition(null);
      return;
    }

    // Prevent moving a folder into its own descendant (only for 'inside' position)
    if (position === 'inside') {
      const isDescendant = (parentId: string | null, checkId: string): boolean => {
        if (!parentId) return false;
        if (parentId === checkId) return true;
        const parent = folders.find(f => f.id === parentId);
        return parent ? isDescendant(parent.parentId, checkId) : false;
      };

      if (isDescendant(targetFolder.id, draggedFolder.id)) {
        toast.error(t('sidebar.cannotMoveToChild'));
        setDraggedFolder(null);
        setDragOverId(null);
        setDragOverPosition(null);
        return;
      }
    }

    try {
      // Use the position to determine the action
      await reorderFolder(draggedFolder.id, targetFolder.id, position);
      toast.success(t('common.success'));
    } catch (error) {
      toast.error(t('common.error'));
    }

    setDraggedFolder(null);
    setDragOverId(null);
    setDragOverPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedFolder(null);
    setDragOverId(null);
    setDragOverPosition(null);
  };

  return (
    <div className="w-64 sb-surface border-r sb-divider flex flex-col h-full" onDragEnd={handleDragEnd}>
      {/* Header */}
      <div className="p-4 border-b sb-divider">
        <div className="flex items-center gap-2">
          <Library className="w-6 h-6 text-violet-400" />
          <div>
            <h1 className="text-base font-bold leading-tight">OrangeDuck</h1>
            <p className="text-[10px] text-slate-400 leading-tight">AI Bookmark Manager</p>
          </div>
        </div>
      </div>

      {/* Folder Title + Action Buttons */}
      <div className="px-3 py-3 border-b sb-divider">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t('sidebar.folders')}
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setIsEditMode(false);
              setIsCreating(!isCreating);
            }}
            className={cn(
              'sb-button flex-1 px-2 py-1.5 text-xs font-medium transition-all flex items-center justify-center gap-1',
              isCreating
                ? 'bg-violet-600 text-white border-violet-500/40'
                : 'sb-secondary'
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('sidebar.newFolder')}</span>
          </button>
          <button
            onClick={() => {
              setIsCreating(false);
              setIsEditMode(!isEditMode);
            }}
            className={cn(
              'sb-button flex-1 px-2 py-1.5 text-xs font-medium transition-all flex items-center justify-center gap-1',
              isEditMode
                ? 'bg-amber-600 text-white border-amber-500/40'
                : 'sb-secondary'
            )}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{t('sidebar.editFolder')}</span>
          </button>
        </div>

        {/* New Folder Input */}
        {isCreating && (
          <div className="mt-2 space-y-2">
            <input
              ref={inputRef}
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('sidebar.folderName')}
              className="w-full px-3 py-2 text-sm sb-input focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setNewFolderName('');
                  setIsCreating(false);
                }}
                className="sb-button flex-1 px-3 py-1.5 text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="sb-button-primary flex-1 px-3 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        )}

        {/* Edit Mode Hint */}
        {isEditMode && (
          <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-xs text-amber-400">{t('sidebar.editHint')}</p>
          </div>
        )}
      </div>

      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-1">
          {folderTree.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              isEditMode={isEditMode}
              onEdit={handleEditFolder}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              dragOverId={dragOverId}
              dragOverPosition={dragOverPosition}
            />
          ))}
        </div>
      </div>

      {/* Keyboard Shortcut Hint */}
      <div className="p-3 border-t sb-divider">
        <div className="flex items-center justify-center gap-2 px-3 py-2 sb-card">
          <Keyboard className="w-4 h-4 sb-muted" />
          <span className="text-sm sb-muted">{t('shortcuts.hint', { key: '?' })}</span>
        </div>
      </div>

      {/* Folder Edit Modal */}
      {editingFolder && (
        <FolderEditModal
          folder={editingFolder}
          onClose={() => setEditingFolder(null)}
          onSave={handleSaveFolder}
          onDelete={handleDeleteFolder}
        />
      )}
    </div>
  );
}
