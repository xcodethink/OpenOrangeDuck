import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { deduplicationService, type DuplicateGroup } from '../services/deduplication';
import { bookmarkService } from '../services/database';
import { storageService } from '../services/storage';
import { safeOpenUrl } from '../utils/url';
import { applyTheme } from '../utils/theme';
import { useSettingsSync } from '../hooks/useSettingsSync';
import {
  GitMerge,
  Trash2,
  Check,
  X,
  Loader2,
  Sparkles,
  Link2,
  ArrowLeft,
  ExternalLink,
  Undo2,
  Search,
  FileText,
  Building2,
  RefreshCw,
  Home,
} from 'lucide-react';

type PageState = 'initial' | 'analyzing' | 'results';
type AnalysisStep = 0 | 1 | 2 | 3; // 0=not started, 1=exact, 2=similar, 3=related

interface StepResult {
  count: number;
  done: boolean;
}

export default function DedupePage() {
  const { t, i18n } = useTranslation();
  const [pageState, setPageState] = useState<PageState>('initial');
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [mergedGroups, setMergedGroups] = useState<Set<number>>(new Set());
  const [ignoredGroups, setIgnoredGroups] = useState<Set<number>>(new Set());
  const [keepIndexMap, setKeepIndexMap] = useState<Map<number, number>>(new Map());
  const [totalBookmarks, setTotalBookmarks] = useState(0);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>(0);
  const [stepResults, setStepResults] = useState<StepResult[]>([
    { count: 0, done: false },
    { count: 0, done: false },
    { count: 0, done: false },
  ]);

  useSettingsSync();

  useEffect(() => {
    (async () => {
      const settings = await storageService.getSettings();
      applyTheme(settings.theme);
      if (settings.language && settings.language !== i18n.language) {
        i18n.changeLanguage(settings.language);
      }
      const count = await bookmarkService.getCount();
      setTotalBookmarks(count);
    })();
  }, []);

  const startAnalysis = async () => {
    setPageState('analyzing');
    setGroups([]);
    setSelectedItems(new Set());
    setMergedGroups(new Set());
    setIgnoredGroups(new Set());
    setKeepIndexMap(new Map());
    setStepResults([
      { count: 0, done: false },
      { count: 0, done: false },
      { count: 0, done: false },
    ]);

    const allBookmarks = await deduplicationService.loadAllBookmarks();
    setTotalBookmarks(allBookmarks.length);

    // Step 1: Exact duplicates
    setAnalysisStep(1);
    await delay(300); // brief delay for UI perception
    const exactGroups = deduplicationService.getExactDuplicates(allBookmarks);
    setStepResults(prev => {
      const next = [...prev];
      next[0] = { count: exactGroups.length, done: true };
      return next;
    });

    // Step 2: Similar content
    setAnalysisStep(2);
    await delay(300);
    const similarGroups = deduplicationService.getSimilarContent(allBookmarks);
    setStepResults(prev => {
      const next = [...prev];
      next[1] = { count: similarGroups.length, done: true };
      return next;
    });

    // Step 3: Domain families
    setAnalysisStep(3);
    await delay(300);
    const domainGroups = deduplicationService.getDomainFamilies(allBookmarks);
    setStepResults(prev => {
      const next = [...prev];
      next[2] = { count: domainGroups.length, done: true };
      return next;
    });

    await delay(400);
    setGroups([...exactGroups, ...similarGroups, ...domainGroups]);
    setPageState('results');
  };

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = (groupIndex: number) => {
    const group = groups[groupIndex];
    const groupIds = group.items.map(item => item.bookmark.id);
    const allSelected = groupIds.every(id => selectedItems.has(id));

    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (allSelected) {
        groupIds.forEach(id => newSet.delete(id));
      } else {
        groupIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const handleMerge = async (groupIndex: number) => {
    const group = groups[groupIndex];
    if (group.items.length > 0) {
      const keepIdx = keepIndexMap.get(groupIndex) ?? 0;
      const keepId = group.items[keepIdx].bookmark.id;
      const deleteIds = group.items
        .filter((_, idx) => idx !== keepIdx)
        .map((item) => item.bookmark.id);
      await deduplicationService.mergeBookmarks(keepId, deleteIds);

      setGroups((prev) => {
        const newGroups = [...prev];
        newGroups[groupIndex] = {
          ...newGroups[groupIndex],
          items: [group.items[keepIdx]],
        };
        return newGroups;
      });
      setMergedGroups((prev) => new Set([...prev, groupIndex]));
      const groupIds = group.items.map(item => item.bookmark.id);
      setSelectedItems((prev) => {
        const newSet = new Set(prev);
        groupIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  const handleIgnore = (groupIndex: number) => {
    setIgnoredGroups((prev) => new Set([...prev, groupIndex]));
  };

  const handleUndoIgnore = (groupIndex: number) => {
    setIgnoredGroups((prev) => {
      const newSet = new Set(prev);
      newSet.delete(groupIndex);
      return newSet;
    });
  };

  const setKeepIndex = (groupIndex: number, itemIndex: number) => {
    setKeepIndexMap((prev) => new Map(prev).set(groupIndex, itemIndex));
  };

  const getKeepIndex = (groupIndex: number) => {
    return keepIndexMap.get(groupIndex) ?? 0;
  };

  const openBookmark = (url: string) => {
    safeOpenUrl(url);
  };

  const isGroupProcessed = (groupIndex: number) => {
    return mergedGroups.has(groupIndex) || ignoredGroups.has(groupIndex);
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;
    try {
      for (const id of selectedItems) {
        await deduplicationService.mergeBookmarks('', [id]);
      }
      setSelectedItems(new Set());
      setMergedGroups(new Set());
      setIgnoredGroups(new Set());
      setKeepIndexMap(new Map());
      await startAnalysis();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleMergeSelected = async () => {
    if (selectedItems.size < 2) return;
    const ids = Array.from(selectedItems);
    const keepId = ids[0];
    const deleteIds = ids.slice(1);
    try {
      await deduplicationService.mergeBookmarks(keepId, deleteIds);
      setSelectedItems(new Set());
      setMergedGroups(new Set());
      setIgnoredGroups(new Set());
      setKeepIndexMap(new Map());
      await startAnalysis();
    } catch (error) {
      console.error('Merge failed:', error);
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'same_url':
        return {
          bg: 'bg-red-500/15',
          border: 'border-red-400/40',
          text: 'text-red-400',
          icon: Link2,
          iconColor: 'text-red-500',
        };
      case 'same_domain':
        return {
          bg: 'bg-cyan-500/15',
          border: 'border-cyan-400/40',
          text: 'text-cyan-400',
          icon: Building2,
          iconColor: 'text-cyan-500',
        };
      case 'similar_content':
        return {
          bg: 'bg-amber-500/15',
          border: 'border-amber-400/40',
          text: 'text-amber-400',
          icon: FileText,
          iconColor: 'text-amber-500',
        };
      default:
        return {
          bg: 'bg-slate-500/15',
          border: 'border-slate-400/40',
          text: 'text-slate-300',
          icon: Link2,
          iconColor: 'text-slate-400',
        };
    }
  };

  const goBack = () => {
    window.close();
  };

  const goHome = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/index.html') });
  };

  // Count groups by type (excluding processed ones)
  const activeGroups = groups.filter((_, i) => !isGroupProcessed(i));
  const sameUrlCount = activeGroups.filter((g) => g.type === 'same_url').length;
  const similarCount = activeGroups.filter((g) => g.type === 'similar_content').length;
  const domainCount = activeGroups.filter((g) => g.type === 'same_domain').length;
  const totalDuplicates = activeGroups
    .filter(g => g.type !== 'same_domain')
    .reduce((sum, g) => sum + g.items.length - 1, 0);

  const analysisSteps = [
    { icon: Link2, color: 'text-red-400', bgColor: 'bg-red-500/20', label: t('dedupe.scanningDuplicates') },
    { icon: FileText, color: 'text-amber-400', bgColor: 'bg-amber-500/20', label: t('dedupe.analyzingSimilarity') },
    { icon: Building2, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', label: t('dedupe.discoveringRelated') },
  ];

  return (
    <div className="min-h-screen sb-page">
      {/* Header */}
      <header className="sticky top-0 z-10 sb-surface backdrop-blur border-b sb-divider">
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <GitMerge className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">{t('dedupe.title')}</h1>
                  {pageState === 'results' && totalDuplicates > 0 && (
                    <p className="text-xs sb-muted">
                      {t('dedupe.totalBookmarks', { count: totalBookmarks })} · {totalDuplicates} {t('dedupe.duplicatesFound')}
                    </p>
                  )}
                  {pageState !== 'results' && (
                    <p className="text-xs sb-muted">
                      {t('dedupe.totalBookmarks', { count: totalBookmarks })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {pageState === 'results' && (
                <button
                  onClick={startAnalysis}
                  className="px-4 py-2 sb-button rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('dedupe.reAnalysis')}
                </button>
              )}
              {selectedItems.size > 0 && (
                <>
                  <span className="text-sm sb-muted">
                    {t('dedupe.selected', { count: selectedItems.size })}
                  </span>
                  <button
                    onClick={handleDeleteSelected}
                    className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('dedupe.deleteSelected')}
                  </button>
                  <button
                    onClick={handleMergeSelected}
                    className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition-colors flex items-center gap-2"
                    disabled={selectedItems.size < 2}
                  >
                    <GitMerge className="w-4 h-4" />
                    {t('dedupe.mergeSelected')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* ===== INITIAL STATE ===== */}
        {pageState === 'initial' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t('dedupe.initialTitle')}</h2>
            <p className="sb-muted text-sm mb-8 text-center max-w-md">{t('dedupe.initialDesc')}</p>

            {/* Three check cards */}
            <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-2xl">
              <div className="p-4 sb-card rounded-xl text-center">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                  <Link2 className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-sm font-medium mb-1">{t('dedupe.sameUrl')}</h3>
                <p className="text-xs sb-muted">{t('dedupe.checkExact')}</p>
              </div>
              <div className="p-4 sb-card rounded-xl text-center">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-sm font-medium mb-1">{t('dedupe.similarContent')}</h3>
                <p className="text-xs sb-muted">{t('dedupe.checkSimilar')}</p>
              </div>
              <div className="p-4 sb-card rounded-xl text-center">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center mx-auto mb-3">
                  <Building2 className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="text-sm font-medium mb-1">{t('dedupe.relatedSites')}</h3>
                <p className="text-xs sb-muted">{t('dedupe.checkRelated')}</p>
              </div>
            </div>

            <button
              onClick={startAnalysis}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              {t('dedupe.startAnalysis')}
            </button>

            <p className="text-xs sb-muted mt-4">
              {t('dedupe.totalBookmarks', { count: totalBookmarks })}
            </p>
          </div>
        )}

        {/* ===== ANALYZING STATE ===== */}
        {pageState === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-6" />
            <h2 className="text-lg font-semibold mb-6">{t('dedupe.analyzing')}</h2>

            <div className="w-full max-w-md space-y-3">
              {analysisSteps.map((step, i) => {
                const StepIcon = step.icon;
                const isActive = analysisStep === i + 1;
                const isDone = stepResults[i].done;

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                      isDone ? 'sb-card opacity-100' : isActive ? 'sb-card opacity-100' : 'opacity-40'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${step.bgColor} flex items-center justify-center flex-shrink-0`}>
                      {isDone ? (
                        <Check className="w-5 h-5 text-emerald-400" />
                      ) : isActive ? (
                        <Loader2 className={`w-5 h-5 ${step.color} animate-spin`} />
                      ) : (
                        <StepIcon className={`w-5 h-5 ${step.color}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{step.label}</p>
                    </div>
                    {isDone && (
                      <span className="text-sm font-medium text-emerald-400">
                        {t('dedupe.found', { count: stepResults[i].count })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== RESULTS STATE ===== */}
        {pageState === 'results' && (
          <>
            {/* Stats overview */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-5 bg-red-500/15 rounded-xl border border-red-400/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/25 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">{sameUrlCount}</p>
                    <p className="text-sm text-red-400">{t('dedupe.sameUrl')}</p>
                  </div>
                </div>
              </div>
              <div className="p-5 bg-amber-500/15 rounded-xl border border-amber-400/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/25 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-500">{similarCount}</p>
                    <p className="text-sm text-amber-400">{t('dedupe.similarContent')}</p>
                  </div>
                </div>
              </div>
              <div className="p-5 bg-cyan-500/15 rounded-xl border border-cyan-400/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/25 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-cyan-500">{domainCount}</p>
                    <p className="text-sm text-cyan-400">{t('dedupe.relatedSites')}</p>
                  </div>
                </div>
              </div>
            </div>

            {groups.length === 0 ? (
              /* No results - clean state */
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold mb-2">{t('dedupe.noResults')}</h2>
                <p className="sb-muted text-sm mb-6">{t('dedupe.totalBookmarks', { count: totalBookmarks })}</p>
                <button
                  onClick={goHome}
                  className="flex items-center gap-2 px-5 py-2.5 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 rounded-xl transition-colors text-sm font-medium"
                >
                  <Home className="w-4 h-4" />
                  {t('options.returnHome')}
                </button>
              </div>
            ) : (
              /* Duplicate groups list */
              <div className="space-y-6">
                {groups.map((group, groupIndex) => {
                  const config = getTypeConfig(group.type);
                  const isProcessed = isGroupProcessed(groupIndex);
                  const isMerged = mergedGroups.has(groupIndex);
                  const isIgnored = ignoredGroups.has(groupIndex);
                  const isDomainFamily = group.type === 'same_domain';
                  const TypeIcon = config.icon;
                  const groupIds = group.items.map(item => item.bookmark.id);
                  const allSelected = groupIds.every(id => selectedItems.has(id));
                  const someSelected = groupIds.some(id => selectedItems.has(id));

                  return (
                    <div
                      key={groupIndex}
                      className={`rounded-xl border overflow-hidden transition-all ${
                        isProcessed ? 'opacity-50' : ''
                      } ${config.bg} ${config.border}`}
                    >
                      {/* Group header */}
                      <div className="p-4 border-b sb-divider flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {!isDomainFamily && (
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someSelected && !allSelected;
                              }}
                              onChange={() => toggleSelectAll(groupIndex)}
                              className="w-4 h-4 rounded sb-input text-violet-500 focus:ring-violet-500"
                              disabled={isProcessed}
                            />
                          )}
                          <TypeIcon className={`w-5 h-5 ${config.iconColor}`} />
                          <div>
                            <span className={`font-semibold ${config.text}`}>{group.label}</span>
                            <span className="sb-muted text-sm ml-2">
                              ({t('dedupe.itemCount', { count: group.items.length })})
                            </span>
                          </div>
                          {isDomainFamily && (
                            <span className="px-2 py-0.5 bg-cyan-500/25 text-cyan-200 rounded text-xs font-medium">
                              {t('dedupe.infoOnly')}
                            </span>
                          )}
                        </div>
                        {!isProcessed && !isDomainFamily && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMerge(groupIndex)}
                              className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors flex items-center gap-2"
                            >
                              <GitMerge className="w-4 h-4" />
                              {t('dedupe.merge')}
                            </button>
                            <button
                              onClick={() => handleIgnore(groupIndex)}
                              className="px-4 py-2 sb-button rounded-lg text-sm transition-colors flex items-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              {t('dedupe.ignore')}
                            </button>
                          </div>
                        )}
                        {!isProcessed && isDomainFamily && (
                          <button
                            onClick={() => handleIgnore(groupIndex)}
                            className="px-4 py-2 sb-button rounded-lg text-sm transition-colors flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            {t('dedupe.ignore')}
                          </button>
                        )}
                        {isMerged && (
                          <span className="px-4 py-2 bg-emerald-500/30 text-emerald-300 rounded-lg text-sm flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            {t('dedupe.processed')}
                          </span>
                        )}
                        {isIgnored && (
                          <button
                            onClick={() => handleUndoIgnore(groupIndex)}
                            className="px-4 py-2 sb-button rounded-lg text-sm transition-colors flex items-center gap-2"
                          >
                            <Undo2 className="w-4 h-4" />
                            {t('action.cancel')}
                          </button>
                        )}
                      </div>

                      {/* Items list */}
                      <div className="divide-y divide-[color:var(--border-secondary)]">
                        {group.items.map((item, itemIndex) => {
                          const isKeepItem = getKeepIndex(groupIndex) === itemIndex;
                          return (
                            <div
                              key={item.bookmark.id}
                              className={`p-4 flex items-center gap-4 hover:bg-white/5 transition-colors ${
                                selectedItems.has(item.bookmark.id) ? 'bg-white/10' : ''
                              } ${isKeepItem && !isDomainFamily ? 'bg-emerald-500/5' : ''}`}
                            >
                              {!isDomainFamily && (
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(item.bookmark.id)}
                                  onChange={() => toggleSelect(item.bookmark.id)}
                                  className="w-4 h-4 rounded sb-input text-violet-500 focus:ring-violet-500"
                                  disabled={isProcessed}
                                />
                              )}
                              {/* Keep badge - only for non-domain-family groups */}
                              {!isDomainFamily && (
                                isKeepItem ? (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs font-medium">
                                    {t('dedupe.keep')}
                                  </span>
                                ) : !isProcessed ? (
                                  <button
                                    onClick={() => setKeepIndex(groupIndex, itemIndex)}
                                    className="px-2 py-0.5 sb-button rounded text-xs hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
                                    title={t('dedupe.clickToKeep')}
                                  >
                                    {t('dedupe.keep')}
                                  </button>
                                ) : (
                                  <span className="w-8" />
                                )
                              )}
                              {/* Domain badge for domain families */}
                              {isDomainFamily && (
                                <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-200 rounded text-xs font-mono flex-shrink-0">
                                  {item.bookmark.domain}
                                </span>
                              )}
                              <img
                                src={item.bookmark.favicon}
                                alt=""
                                className="w-5 h-5 rounded flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>';
                                }}
                              />
                              <div
                                className="flex-1 min-w-0 cursor-pointer group"
                                onClick={() => openBookmark(item.bookmark.url)}
                              >
                                <p className="font-medium truncate group-hover:text-violet-400 transition-colors">
                                  {item.bookmark.title}
                                </p>
                                <p className="text-xs sb-muted truncate group-hover:text-[var(--text-secondary)] transition-colors">
                                  {item.bookmark.url}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 text-sm flex-shrink-0">
                                {item.similarity && item.similarity < 1 && (
                                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
                                    {Math.round(item.similarity * 100)}%
                                  </span>
                                )}
                                <span className="sb-muted whitespace-nowrap">
                                  {new Date(item.bookmark.createdAt).toLocaleDateString()}
                                </span>
                                <button
                                  onClick={() => openBookmark(item.bookmark.url)}
                                  className="p-1.5 rounded-lg sb-button-ghost sb-muted hover:text-[var(--text-primary)] transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
