import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { bookmarkService } from '../services/database';
import { storageService } from '../services/storage';
import { safeOpenUrl } from '../utils/url';
import { applyTheme } from '../utils/theme';
import { useSettingsSync } from '../hooks/useSettingsSync';
import type { Bookmark } from '../types';
import {
  Tag,
  ArrowLeft,
  Search,
  Hash,
  Edit3,
  Trash2,
  Link2,
  Check,
  X,
  ExternalLink,
  Loader2,
  Home,
} from 'lucide-react';

interface TagInfo {
  name: string;
  count: number;
}

export default function TagsPage() {
  const { t, i18n } = useTranslation();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [mergeSource, setMergeSource] = useState<string | null>(null);

  useSettingsSync();

  useEffect(() => {
    loadBookmarks();
    (async () => {
      const settings = await storageService.getSettings();
      applyTheme(settings.theme);
      if (settings.language && settings.language !== i18n.language) {
        i18n.changeLanguage(settings.language);
      }
    })();
  }, []);

  const loadBookmarks = async () => {
    setIsLoading(true);
    try {
      const allBookmarks = await bookmarkService.getAll();
      setBookmarks(allBookmarks);
    } finally {
      setIsLoading(false);
    }
  };

  // Compute tag stats
  const tagStats = useMemo(() => {
    const stats = new Map<string, number>();
    bookmarks.forEach(b => {
      b.tags.forEach(tag => {
        stats.set(tag, (stats.get(tag) || 0) + 1);
      });
    });

    const result: TagInfo[] = [];
    stats.forEach((count, name) => {
      result.push({ name, count });
    });

    return result.sort((a, b) => b.count - a.count);
  }, [bookmarks]);

  // Filter tags by search
  const filteredTags = useMemo(() => {
    if (!searchQuery) return tagStats;
    return tagStats.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tagStats, searchQuery]);

  // Get bookmarks for selected tag
  const taggedBookmarks = useMemo(() => {
    if (!selectedTag) return [];
    return bookmarks.filter(b => b.tags.includes(selectedTag));
  }, [bookmarks, selectedTag]);

  // Rename tag
  const handleRenameTag = async (oldName: string) => {
    if (!newTagName.trim() || newTagName === oldName) {
      setEditingTag(null);
      setNewTagName('');
      return;
    }

    try {
      const affectedBookmarks = bookmarks.filter(b => b.tags.includes(oldName));
      for (const bookmark of affectedBookmarks) {
        const newTags = bookmark.tags.map(t => t === oldName ? newTagName.trim() : t);
        await bookmarkService.update(bookmark.id, { tags: newTags });
      }

      if (selectedTag === oldName) {
        setSelectedTag(newTagName.trim());
      }

      await loadBookmarks();
      setEditingTag(null);
      setNewTagName('');
    } catch (error) {
      console.error('Rename failed:', error);
    }
  };

  // Delete tag
  const handleDeleteTag = async (tagName: string) => {
    if (!confirm(t('tags.deleteConfirm', { name: tagName }))) return;

    try {
      const affectedBookmarks = bookmarks.filter(b => b.tags.includes(tagName));
      for (const bookmark of affectedBookmarks) {
        const newTags = bookmark.tags.filter(t => t !== tagName);
        await bookmarkService.update(bookmark.id, { tags: newTags });
      }

      if (selectedTag === tagName) {
        setSelectedTag(null);
      }

      await loadBookmarks();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  // Merge tags
  const handleMergeTags = async (targetTag: string) => {
    if (!mergeSource || mergeSource === targetTag) return;

    try {
      const affectedBookmarks = bookmarks.filter(b => b.tags.includes(mergeSource));
      for (const bookmark of affectedBookmarks) {
        const newTags = bookmark.tags.filter(t => t !== mergeSource);
        if (!newTags.includes(targetTag)) {
          newTags.push(targetTag);
        }
        await bookmarkService.update(bookmark.id, { tags: newTags });
      }

      if (selectedTag === mergeSource) {
        setSelectedTag(targetTag);
      }

      await loadBookmarks();
      setMergeSource(null);
    } catch (error) {
      console.error('Merge failed:', error);
    }
  };

  const openBookmark = (url: string) => {
    safeOpenUrl(url);
  };

  const goBack = () => {
    window.close();
  };

  const goHome = () => {
    window.location.href = chrome.runtime.getURL('src/manager/index.html');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen sb-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
          <p className="sb-muted text-sm">Loading tags...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen sb-page flex">
      {/* Left Panel - Tags List */}
      <div className="w-80 border-r sb-divider flex flex-col">
        {/* Header */}
        <div className="p-4 border-b sb-divider">
          <div className="flex items-center gap-3 mb-4">
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
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg sb-card flex items-center justify-center">
                <Tag className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <h1 className="text-base font-semibold">{t('tags.manager')}</h1>
                <p className="text-xs sb-muted">{tagStats.length} {t('tags.total')}</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sb-muted" />
            <input
              type="text"
              placeholder={t('tags.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sb-input rounded-lg px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
        </div>

        {/* Merge Mode Banner */}
        {mergeSource && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between">
            <span className="text-xs text-amber-400">
              {t('tags.mergeMode')}: <strong>{mergeSource}</strong>
            </span>
            <button
              onClick={() => setMergeSource(null)}
              className="text-xs px-2 py-1 sb-button rounded"
            >
              {t('action.cancel')}
            </button>
          </div>
        )}

        {/* Tags List */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredTags.length === 0 ? (
            <div className="text-center py-12 sb-muted">
              <Tag className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t('tags.empty')}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTags.map((tag) => (
                <div
                  key={tag.name}
                  className={`group p-2.5 rounded-lg transition-all cursor-pointer sb-card ${
                    selectedTag === tag.name
                      ? 'bg-violet-500/20 border-violet-500/50'
                      : mergeSource === tag.name
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : mergeSource
                      ? 'sb-card-hover hover:border-amber-500/50'
                      : 'sb-card-hover'
                  }`}
                  onClick={() => {
                    if (mergeSource && mergeSource !== tag.name) {
                      handleMergeTags(tag.name);
                    } else if (!mergeSource) {
                      setSelectedTag(tag.name);
                    }
                  }}
                >
                  {editingTag === tag.name ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameTag(tag.name);
                          if (e.key === 'Escape') {
                            setEditingTag(null);
                            setNewTagName('');
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="flex-1 sb-input rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenameTag(tag.name);
                        }}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTag(null);
                          setNewTagName('');
                        }}
                        className="p-1 sb-muted hover:text-[var(--text-primary)]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Hash className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{tag.name}</span>
                        <span className="text-xs sb-muted sb-surface px-1.5 py-0.5 rounded flex-shrink-0">
                          {tag.count}
                        </span>
                      </div>
                      {!mergeSource && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTag(tag.name);
                              setNewTagName(tag.name);
                            }}
                            className="p-1.5 rounded sb-muted hover:text-[var(--text-primary)] sb-button-ghost"
                            title={t('action.rename')}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMergeSource(tag.name);
                            }}
                            className="p-1.5 rounded sb-muted hover:text-amber-400 sb-button-ghost"
                            title={t('action.merge')}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTag(tag.name);
                            }}
                            className="p-1.5 rounded sb-muted hover:text-red-500 sb-button-ghost"
                            title={t('action.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t sb-divider text-xs sb-muted text-center">
          {t('tags.hint')}
        </div>
      </div>

      {/* Right Panel - Bookmarks */}
      <div className="flex-1 flex flex-col">
        {selectedTag ? (
          <>
            {/* Selected tag header */}
            <div className="p-4 border-b sb-divider sb-surface">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                  <Hash className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{selectedTag}</h2>
                  <p className="text-xs sb-muted">
                    {taggedBookmarks.length} {t('tags.bookmarks')}
                  </p>
                </div>
              </div>
            </div>

            {/* Bookmarks list */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                {taggedBookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="p-4 sb-card rounded-xl sb-card-hover transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={bookmark.favicon}
                        alt=""
                        className="w-8 h-8 rounded-lg flex-shrink-0 sb-surface"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className="font-medium text-sm truncate cursor-pointer hover:text-violet-400 transition-colors"
                            onClick={() => openBookmark(bookmark.url)}
                          >
                            {bookmark.title}
                          </h3>
                          <button
                            onClick={() => openBookmark(bookmark.url)}
                            className="p-1 rounded sb-button-ghost sb-muted hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs sb-muted truncate mt-0.5">{bookmark.domain}</p>
                        {bookmark.summary && (
                          <p className="text-xs sb-secondary mt-2 line-clamp-2">{bookmark.summary}</p>
                        )}
                        {bookmark.tags.length > 1 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {bookmark.tags.filter(t => t !== selectedTag).slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 sb-pill rounded text-xs cursor-pointer hover:text-violet-400"
                                onClick={() => setSelectedTag(tag)}
                              >
                                #{tag}
                              </span>
                            ))}
                            {bookmark.tags.length > 4 && (
                              <span className="text-xs sb-muted">
                                +{bookmark.tags.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl sb-card flex items-center justify-center mx-auto mb-4">
                <Tag className="w-8 h-8 sb-muted" />
              </div>
              <p className="sb-muted text-sm">{t('tags.selectHint')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
