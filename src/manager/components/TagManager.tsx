import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import { bookmarkService } from '../../services/database';
import { toast } from '../../components/Toast';
import { Tag, X, Search, Check, Pencil, Link2, Trash2 } from 'lucide-react';

interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TagInfo {
  name: string;
  count: number;
}

export default function TagManager({ isOpen, onClose }: TagManagerProps) {
  const { t } = useTranslation();
  const { bookmarks, loadAll } = useBookmarkStore();
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 统计所有标签
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

    // 按使用次数排序
    return result.sort((a, b) => b.count - a.count);
  }, [bookmarks]);

  // 过滤标签
  const filteredTags = useMemo(() => {
    if (!searchQuery) return tagStats;
    return tagStats.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tagStats, searchQuery]);

  // 重命名标签
  const handleRenameTag = async (oldName: string) => {
    if (!newTagName.trim() || newTagName === oldName) {
      setEditingTag(null);
      setNewTagName('');
      return;
    }

    try {
      // 更新所有包含该标签的书签
      const affectedBookmarks = bookmarks.filter(b => b.tags.includes(oldName));

      for (const bookmark of affectedBookmarks) {
        const newTags = bookmark.tags.map(t => t === oldName ? newTagName.trim() : t);
        await bookmarkService.update(bookmark.id, { tags: newTags });
      }

      toast.success(t('tags.renamed', { count: affectedBookmarks.length }));
      loadAll();
      setEditingTag(null);
      setNewTagName('');
    } catch (error) {
      toast.error(t('tags.renameError'));
    }
  };

  // 删除标签
  const handleDeleteTag = async (tagName: string) => {
    if (!confirm(t('tags.deleteConfirm', { name: tagName }))) return;

    try {
      const affectedBookmarks = bookmarks.filter(b => b.tags.includes(tagName));

      for (const bookmark of affectedBookmarks) {
        const newTags = bookmark.tags.filter(t => t !== tagName);
        await bookmarkService.update(bookmark.id, { tags: newTags });
      }

      toast.success(t('tags.deleted', { count: affectedBookmarks.length }));
      loadAll();
    } catch (error) {
      toast.error(t('tags.deleteError'));
    }
  };

  // 合并标签
  const [mergeSource, setMergeSource] = useState<string | null>(null);

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

      toast.success(t('tags.merged', { from: mergeSource, to: targetTag, count: affectedBookmarks.length }));
      loadAll();
      setMergeSource(null);
    } catch (error) {
      toast.error(t('tags.mergeError'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="sb-card w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sb-divider">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5 text-violet-500" />
            {t('tags.manager')}
            <span className="text-sm sb-muted font-normal">({tagStats.length})</span>
          </h2>
          <button
            onClick={onClose}
            className="sb-button w-8 h-8 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b sb-divider">
          <div className="relative">
            <input
              type="text"
              placeholder={t('tags.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sb-input px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 sb-muted">
              <Search className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Merge Mode Banner */}
        {mergeSource && (
          <div className="px-4 py-2 bg-amber-500/20 border-b border-amber-500/30 flex items-center justify-between">
            <span className="text-sm text-amber-400">
              {t('tags.mergeMode')}: <strong>{mergeSource}</strong> → {t('tags.selectTarget')}
            </span>
            <button
              onClick={() => setMergeSource(null)}
              className="text-xs px-2 py-1 sb-button rounded"
            >
              {t('action.cancel')}
            </button>
          </div>
        )}

        {/* Tag List */}
        <div className="flex-1 overflow-auto p-4">
          {filteredTags.length === 0 ? (
          <div className="text-center py-12 sb-muted">
            <Tag className="w-10 h-10 mx-auto mb-4 sb-muted" />
            <p>{t('tags.empty')}</p>
          </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredTags.map((tag) => (
                <div
                  key={tag.name}
                  className={`group p-3 rounded-lg transition-all sb-card ${
                    mergeSource === tag.name
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : mergeSource
                      ? 'sb-card-hover hover:border-amber-500/50 cursor-pointer'
                      : 'sb-card-hover'
                  }`}
                  onClick={() => mergeSource && mergeSource !== tag.name && handleMergeTags(tag.name)}
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
                        autoFocus
                        className="flex-1 sb-input rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      />
                        <button
                          onClick={() => handleRenameTag(tag.name)}
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingTag(null);
                            setNewTagName('');
                          }}
                          className="sb-muted hover:text-[var(--text-primary)]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-violet-500">#</span>
                        <span className="font-medium">{tag.name}</span>
                        <span className="text-xs sb-muted sb-surface px-1.5 py-0.5 rounded">
                          {tag.count}
                        </span>
                      </div>
                      {!mergeSource && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTag(tag.name);
                              setNewTagName(tag.name);
                            }}
                            className="p-1 rounded sb-button-ghost sb-muted hover:text-[var(--text-primary)]"
                            title={t('action.rename')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMergeSource(tag.name);
                            }}
                            className="p-1 rounded sb-button-ghost sb-muted hover:text-amber-400"
                            title={t('action.merge')}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTag(tag.name);
                            }}
                            className="p-1 rounded sb-button-ghost sb-muted hover:text-red-500"
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

        {/* Footer */}
        <div className="p-4 border-t sb-divider text-xs sb-muted text-center">
          {t('tags.hint')}
        </div>
      </div>
    </div>
  );
}
