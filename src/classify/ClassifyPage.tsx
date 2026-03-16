import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { bookmarkService, folderService, db } from '../services/database';
import { storageService } from '../services/storage';
import { classifyService, type ClassificationResult, type ClassifiedFolder } from '../services/classify';
import { safeOpenUrl } from '../utils/url';
import { applyTheme } from '../utils/theme';
import { useSettingsSync } from '../hooks/useSettingsSync';
import type { Bookmark, Folder } from '../types';
import {
  ArrowLeft,
  Wand2,
  Loader2,
  Check,
  X,
  GripVertical,
  FolderPlus,
  Folder as FolderIcon,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  Sparkles,
  Save,
  CheckCircle,
  LogIn,
  Home,
} from 'lucide-react';

interface DragItem {
  type: 'bookmark' | 'folder';
  id: string;
  sourceFolderId: string;
}

export default function ClassifyPage() {
  const { t, i18n } = useTranslation();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState<ClassificationResult | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  useSettingsSync();

  useEffect(() => {
    loadData();
    (async () => {
      const settings = await storageService.getSettings();
      applyTheme(settings.theme);
      if (settings.language && settings.language !== i18n.language) {
        i18n.changeLanguage(settings.language);
      }
      // Check login status for proxy mode
      if (settings.apiMode === 'proxy' && !settings.userToken) {
        setIsLoggedIn(false);
      }
    })();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allBookmarks = await bookmarkService.getAll();
      setBookmarks(allBookmarks);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartClassify = async () => {
    if (bookmarks.length === 0) {
      setError(t('classify.noBookmarks'));
      return;
    }

    // Re-check login status before starting (token may have been obtained after page load)
    const settings = await storageService.getSettings();
    if (settings.apiMode === 'proxy' && !settings.userToken) {
      setIsLoggedIn(false);
      setError(t('errors.AI_NOT_LOGGED_IN'));
      return;
    }
    setIsLoggedIn(true);

    setIsClassifying(true);
    setError(null);
    setProgress({ current: 0, total: bookmarks.length });

    try {
      const result = await classifyService.classifyBookmarks(
        bookmarks,
        (current, total) => setProgress({ current, total })
      );
      setClassificationResult(result);
      // Expand all folders by default
      setExpandedFolders(new Set(result.folders.map(f => f.id)));
    } catch (err) {
      console.error('Classification failed:', err);
      setError(t('classify.error') + ': ' + (err as Error).message);
    } finally {
      setIsClassifying(false);
      setProgress(null);
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, item: DragItem) => {
    setDragItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    if (dragItem && dragItem.sourceFolderId !== folderId) {
      setDragOverFolder(folderId);
    }
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    setDragOverFolder(null);

    if (!dragItem || !classificationResult) return;

    // Dropping on the same folder — no-op
    if (dragItem.sourceFolderId === targetFolderId) {
      setDragItem(null);
      return;
    }

    if (dragItem.type === 'bookmark') {
      // Move bookmark to target folder
      setClassificationResult(prev => {
        if (!prev) return null;

        const newFolders = prev.folders.map(folder => {
          if (folder.id === dragItem.sourceFolderId) {
            return {
              ...folder,
              bookmarkIds: folder.bookmarkIds.filter(id => id !== dragItem.id),
            };
          }
          if (folder.id === targetFolderId) {
            return {
              ...folder,
              bookmarkIds: [...folder.bookmarkIds, dragItem.id],
            };
          }
          return folder;
        });

        return { ...prev, folders: newFolders };
      });
    }

    setDragItem(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverFolder(null);
  };

  const handleRenameFolder = (folderId: string) => {
    if (!newFolderName.trim() || !classificationResult) {
      setEditingFolder(null);
      setNewFolderName('');
      return;
    }

    setClassificationResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        folders: prev.folders.map(f =>
          f.id === folderId ? { ...f, name: newFolderName.trim() } : f
        ),
      };
    });

    setEditingFolder(null);
    setNewFolderName('');
  };

  const handleDeleteFolder = (folderId: string) => {
    if (!classificationResult) return;

    const folder = classificationResult.folders.find(f => f.id === folderId);
    if (!folder) return;

    // Move bookmarks to uncategorized or first folder
    const uncategorized = classificationResult.folders.find(f => f.id === 'uncategorized');
    const targetFolder = uncategorized || classificationResult.folders[0];

    if (!targetFolder || targetFolder.id === folderId) return;

    setClassificationResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        folders: prev.folders
          .filter(f => f.id !== folderId)
          .map(f =>
            f.id === targetFolder.id
              ? { ...f, bookmarkIds: [...f.bookmarkIds, ...folder.bookmarkIds] }
              : f
          ),
      };
    });
  };

  const handleAddFolder = () => {
    if (!classificationResult) return;

    const newFolder: ClassifiedFolder = {
      id: 'new_' + Date.now(),
      name: t('classify.newFolder'),
      icon: 'folder',
      bookmarkIds: [],
    };

    setClassificationResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        folders: [...prev.folders, newFolder],
      };
    });

    setEditingFolder(newFolder.id);
    setNewFolderName(newFolder.name);
    setExpandedFolders(prev => new Set([...prev, newFolder.id]));
  };

  const handleApplyChanges = async () => {
    if (!classificationResult) return;

    setIsSaving(true);
    setError(null);

    try {
      // Clear existing non-system folders
      const existingFolders = await folderService.getAll();
      for (const folder of existingFolders) {
        if (folder.id !== 'all') {
          await folderService.delete(folder.id);
        }
      }

      // Create new folders
      const now = new Date().toISOString();
      for (let i = 0; i < classificationResult.folders.length; i++) {
        const cf = classificationResult.folders[i];
        const folder: Folder = {
          id: cf.id.startsWith('new_') ? 'folder_' + Date.now() + '_' + i : cf.id,
          name: cf.name,
          icon: cf.icon,
          parentId: null,
          order: i + 1,
          createdAt: now,
        };

        await db.folders.put(folder);

        // Update bookmarks to point to this folder
        for (const bookmarkId of cf.bookmarkIds) {
          await bookmarkService.update(bookmarkId, { folderId: folder.id });
        }
      }

      setSaveSuccess(true);
    } catch (err) {
      console.error('Save failed:', err);
      setError(t('classify.saveError') + ': ' + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const getBookmarkById = useCallback(
    (id: string) => bookmarks.find(b => b.id === id),
    [bookmarks]
  );

  const goBack = () => {
    window.close();
  };

  const goHome = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/index.html') });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen sb-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
          <p className="sb-muted text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen sb-page flex flex-col">
      {/* Header */}
      <div className="border-b sb-divider sb-surface">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <button
                  onClick={goHome}
                  className="p-2 rounded-lg sb-button-ghost sb-muted hover:text-violet-400 transition-colors"
                  title={t('options.backToHome')}
                >
                  <Home className="w-5 h-5" />
                </button>
                <button
                  onClick={goBack}
                  className="p-2 rounded-lg sb-button-ghost sb-muted hover:text-[var(--text-primary)] transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">{t('classify.title')}</h1>
                  <p className="text-xs sb-muted">{t('classify.subtitle')}</p>
                </div>
              </div>
            </div>

            {classificationResult && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddFolder}
                  className="flex items-center gap-2 px-3 py-2 sb-button rounded-lg text-sm"
                >
                  <FolderPlus className="w-4 h-4" />
                  {t('classify.addFolder')}
                </button>
                <button
                  onClick={handleApplyChanges}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {t('classify.apply')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {saveSuccess && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <p className="text-sm text-emerald-400">{t('classify.saveSuccess', 'Classification saved successfully!')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={goHome}
                  className="flex items-center gap-2 px-4 py-1.5 text-sm bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 rounded-lg transition-colors"
                >
                  <Home className="w-4 h-4" />
                  {t('options.returnHome')}
                </button>
                <button
                  onClick={() => window.close()}
                  className="px-4 py-1.5 text-sm sb-button rounded-lg"
                >
                  {t('common.close', 'Close')}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!classificationResult ? (
            // Start classification screen
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center mb-6">
                <Sparkles className="w-12 h-12 text-violet-500" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">{t('classify.welcome')}</h2>
              <p className="text-center sb-muted mb-8 max-w-md">
                {t('classify.welcomeDesc')}
              </p>

              <div className="sb-card rounded-xl p-6 mb-8 max-w-md w-full">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm sb-muted">{t('classify.totalBookmarks')}</span>
                  <span className="text-2xl font-bold text-violet-500">{bookmarks.length}</span>
                </div>
                <p className="text-xs sb-muted">{t('classify.aiWillAnalyze')}</p>
              </div>

              {!isLoggedIn ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center max-w-md">
                    <p className="text-sm text-amber-400 mb-3">{t('errors.AI_NOT_LOGGED_IN')}</p>
                    <button
                      onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/auth/index.html') })}
                      className="flex items-center gap-2 mx-auto px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <LogIn className="w-4 h-4" />
                      {t('auth.signIn')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleStartClassify}
                  disabled={isClassifying || bookmarks.length === 0}
                  className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl text-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isClassifying ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      {progress
                        ? t('classify.analyzing', { current: progress.current, total: progress.total })
                        : t('classify.analyzing', { current: 0, total: bookmarks.length })}
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-6 h-6" />
                      {t('classify.startClassify')}
                    </>
                  )}
                </button>
              )}

              {bookmarks.length === 0 && (
                <p className="text-sm text-amber-400 mt-4">{t('classify.noBookmarks')}</p>
              )}
            </div>
          ) : (
            // Classification result - sidebar + content layout
            <div className="flex gap-6">
              {/* Left sidebar — folder navigation (sticky, always visible drop targets) */}
              <div className="w-56 flex-shrink-0">
                <div className="sticky top-0 space-y-1">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold sb-muted uppercase tracking-wider">{t('classify.folders')}</p>
                    <button
                      onClick={handleStartClassify}
                      disabled={isClassifying}
                      className="p-1 sb-muted hover:text-violet-400 transition-colors"
                      title={t('classify.reclassify')}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {classificationResult.folders.map(folder => (
                    <div
                      key={folder.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all ${
                        dragOverFolder === folder.id
                          ? 'ring-2 ring-violet-500 bg-violet-500/20 text-violet-300'
                          : 'sb-button-ghost hover:bg-[var(--bg-hover)]'
                      }`}
                      onDragOver={e => handleDragOver(e, folder.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, folder.id)}
                      onClick={() => {
                        // Scroll to and expand this folder in the main content
                        if (!expandedFolders.has(folder.id)) {
                          setExpandedFolders(prev => new Set([...prev, folder.id]));
                        }
                        document.getElementById(`folder-${folder.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      <FolderIcon className="w-4 h-4 sb-muted flex-shrink-0" />
                      <span className="truncate flex-1">{folder.name}</span>
                      <span className="text-xs sb-muted flex-shrink-0">{folder.bookmarkIds.length}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right content — folder cards */}
              <div className="flex-1 min-w-0 space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm sb-muted">
                    {t('classify.resultDesc', { folders: classificationResult.folders.length })}
                  </p>
                </div>

                {classificationResult.folders.map(folder => (
                  <div
                    key={folder.id}
                    id={`folder-${folder.id}`}
                    className={`sb-card rounded-xl overflow-hidden transition-all ${
                      dragOverFolder === folder.id ? 'ring-2 ring-violet-500 bg-violet-500/10' : ''
                    }`}
                    onDragOver={e => handleDragOver(e, folder.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, folder.id)}
                  >
                    {/* Folder header */}
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <button className="p-1">
                        {expandedFolders.has(folder.id) ? (
                          <ChevronDown className="w-4 h-4 sb-muted" />
                        ) : (
                          <ChevronRight className="w-4 h-4 sb-muted" />
                        )}
                      </button>

                      {editingFolder === folder.id ? (
                        <div className="flex-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameFolder(folder.id);
                              if (e.key === 'Escape') {
                                setEditingFolder(null);
                                setNewFolderName('');
                              }
                            }}
                            autoFocus
                            className="flex-1 sb-input rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                          />
                          <button
                            onClick={() => handleRenameFolder(folder.id)}
                            className="p-1.5 text-emerald-400 hover:text-emerald-300"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingFolder(null);
                              setNewFolderName('');
                            }}
                            className="p-1.5 sb-muted hover:text-[var(--text-primary)]"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium flex-1">{folder.name}</span>
                          <span className="text-xs sb-muted sb-surface px-2 py-1 rounded">
                            {folder.bookmarkIds.length} {t('classify.items')}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setEditingFolder(folder.id);
                                setNewFolderName(folder.name);
                              }}
                              className="p-1.5 sb-muted hover:text-[var(--text-primary)] rounded sb-button-ghost"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.id);
                              }}
                              className="p-1.5 sb-muted hover:text-red-500 rounded sb-button-ghost"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Folder content */}
                    {expandedFolders.has(folder.id) && (
                      <div className="border-t sb-divider p-3">
                        {folder.bookmarkIds.length === 0 ? (
                          <p className="text-sm sb-muted text-center py-4">
                            {t('classify.emptyFolder')}
                          </p>
                        ) : (
                          <div className="grid gap-2 grid-cols-1 lg:grid-cols-2">
                            {folder.bookmarkIds.map(bookmarkId => {
                              const bookmark = getBookmarkById(bookmarkId);
                              if (!bookmark) return null;

                              return (
                                <div
                                  key={bookmark.id}
                                  draggable
                                  onDragStart={e =>
                                    handleDragStart(e, {
                                      type: 'bookmark',
                                      id: bookmark.id,
                                      sourceFolderId: folder.id,
                                    })
                                  }
                                  onDragEnd={handleDragEnd}
                                  className={`group flex items-center gap-3 p-3 sb-card rounded-lg sb-card-hover cursor-grab active:cursor-grabbing transition-all ${
                                    dragItem?.id === bookmark.id ? 'opacity-50' : ''
                                  }`}
                                >
                                  <GripVertical className="w-4 h-4 sb-muted flex-shrink-0" />
                                  <img
                                    src={bookmark.favicon}
                                    alt=""
                                    className="w-6 h-6 rounded flex-shrink-0"
                                    onError={e => {
                                      (e.target as HTMLImageElement).src =
                                        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>';
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{bookmark.title}</p>
                                    <p className="text-xs sb-muted truncate">{bookmark.domain}</p>
                                  </div>
                                  <button
                                    onClick={() => safeOpenUrl(bookmark.url)}
                                    className="p-1.5 sb-muted hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity rounded sb-button-ghost"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
