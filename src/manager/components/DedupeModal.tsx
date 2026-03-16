import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { deduplicationService, type DuplicateGroup } from '../../services/deduplication';
import { GitMerge, Link2, FileText, Loader2, Sparkles, Check } from 'lucide-react';

interface DedupeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DedupeModal({ isOpen, onClose }: DedupeModalProps) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [processedGroups, setProcessedGroups] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDuplicates();
    }
  }, [isOpen]);

  const loadDuplicates = async () => {
    setIsLoading(true);
    try {
      const duplicateGroups = await deduplicationService.getDuplicateGroups();
      setGroups(duplicateGroups);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleMerge = async (groupIndex: number) => {
    const group = groups[groupIndex];
    if (group.items.length > 0) {
      const keepId = group.items[0].bookmark.id;
      const deleteIds = group.items.slice(1).map((item) => item.bookmark.id);
      await deduplicationService.mergeBookmarks(keepId, deleteIds);
      setProcessedGroups((prev) => new Set([...prev, groupIndex]));
    }
  };

  const handleIgnore = (groupIndex: number) => {
    setProcessedGroups((prev) => new Set([...prev, groupIndex]));
  };

  // Handle delete selected items
  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;

    try {
      for (const id of selectedItems) {
        await deduplicationService.mergeBookmarks('', [id]);
      }
      setSelectedItems(new Set());
      await loadDuplicates();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  // Handle merge selected items (keep first, delete rest)
  const handleMergeSelected = async () => {
    if (selectedItems.size < 2) return;

    const ids = Array.from(selectedItems);
    const keepId = ids[0];
    const deleteIds = ids.slice(1);

    try {
      await deduplicationService.mergeBookmarks(keepId, deleteIds);
      setSelectedItems(new Set());
      await loadDuplicates();
    } catch (error) {
      console.error('Merge failed:', error);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'same_url':
        return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300' };
      case 'same_domain':
        return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300' };
      case 'similar_content':
        return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300' };
      default:
        return { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-300' };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-4xl sb-card shadow-2xl animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b sb-divider bg-gradient-to-r from-amber-500/20 to-transparent">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
              <GitMerge className="w-5 h-5" />
              {t('dedupe.title')}
            </h2>
            <button onClick={onClose} className="sb-button-ghost sb-muted text-2xl leading-none">
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-10">
              <Loader2 className="w-8 h-8 mx-auto sb-muted animate-spin" />
              <p className="mt-4 sb-muted">Scanning for duplicates...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-10">
              <Sparkles className="w-10 h-10 mx-auto sb-muted" />
              <p className="mt-4 sb-muted">No duplicates found!</p>
            </div>
          ) : (
            <>
              {/* Stats overview */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30 text-center">
                  <p className="text-2xl font-bold text-red-400">
                    {groups.filter((g) => g.type === 'same_url').length}
                  </p>
                  <p className="text-sm text-red-300">{t('dedupe.sameUrl')}</p>
                </div>
                <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 text-center">
                  <p className="text-2xl font-bold text-amber-400">
                    {groups.filter((g) => g.type === 'same_domain').length}
                  </p>
                  <p className="text-sm text-amber-300">{t('dedupe.sameDomain')}</p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/30 text-center">
                  <p className="text-2xl font-bold text-blue-400">
                    {groups.filter((g) => g.type === 'similar_content').length}
                  </p>
                  <p className="text-sm text-blue-300">{t('dedupe.similarContent')}</p>
                </div>
              </div>

              {/* Duplicate groups list */}
              <div className="space-y-4">
                {groups.map((group, groupIndex) => {
                  const colors = getTypeColor(group.type);
                  const Icon = group.type === 'same_url'
                    ? Link2
                    : group.type === 'similar_content'
                    ? FileText
                    : GitMerge;
                  const isProcessed = processedGroups.has(groupIndex);

                  return (
                    <div
                      key={groupIndex}
                      className={`rounded-xl border overflow-hidden transition-all ${
                        isProcessed ? 'opacity-50' : ''
                      } ${colors.bg} ${colors.border}`}
                    >
                      {/* Group header */}
                      <div className="p-4 border-b sb-divider flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className={`w-5 h-5 ${colors.text}`} />
                          <div>
                            <span className={`font-semibold ${colors.text}`}>{group.label}</span>
                            <span className="sb-muted text-sm ml-2">
                              ({group.items.length} items)
                            </span>
                          </div>
                        </div>
                        {!isProcessed && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMerge(groupIndex)}
                              className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors"
                            >
                              {t('dedupe.merge')}
                            </button>
                            <button
                              onClick={() => handleIgnore(groupIndex)}
                              className="px-3 py-1.5 sb-button rounded-lg text-sm transition-colors"
                            >
                              {t('dedupe.ignore')}
                            </button>
                          </div>
                        )}
                        {isProcessed && (
                          <span className="px-3 py-1.5 bg-emerald-500/30 text-emerald-300 rounded-lg text-sm flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            {t('dedupe.processed')}
                          </span>
                        )}
                      </div>

                      {/* Duplicate items list */}
                      <div className="divide-y divide-[color:var(--border-secondary)]">
                        {group.items.map((item) => (
                          <div
                            key={item.bookmark.id}
                            className={`p-4 flex items-center gap-4 hover:bg-white/5 transition-colors ${
                              selectedItems.has(item.bookmark.id) ? 'bg-white/10' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedItems.has(item.bookmark.id)}
                              onChange={() => toggleSelect(item.bookmark.id)}
                              className="w-4 h-4 rounded sb-input text-violet-500 focus:ring-violet-500"
                              disabled={isProcessed}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {item.bookmark.title}
                              </p>
                              <p className="text-xs sb-muted truncate">{item.bookmark.url}</p>
                            </div>
                            <div className="text-right text-sm">
                              {item.similarity && (
                                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs mr-2">
                                  {Math.round(item.similarity * 100)}% similar
                                </span>
                              )}
                              <span className="sb-muted">
                                {new Date(item.bookmark.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom actions */}
              <div className="mt-6 pt-4 border-t sb-divider flex items-center justify-between">
                <p className="text-sm sb-muted">
                  {t('dedupe.selected', { count: selectedItems.size })}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteSelected}
                    className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    disabled={selectedItems.size === 0}
                  >
                    {t('dedupe.deleteSelected')} ({selectedItems.size})
                  </button>
                  <button
                    onClick={handleMergeSelected}
                    className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                    disabled={selectedItems.size < 2}
                  >
                    {t('dedupe.mergeSelected')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
