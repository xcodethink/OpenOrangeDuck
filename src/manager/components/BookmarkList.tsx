import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Bookmark, Folder, DomainInfo } from '../../types';
import { safeOpenUrl } from '../../utils/url';
import { isKnownBrandRegionalDomain } from '../../utils/brandImpersonation';
import StatusBadge from '../../components/StatusBadge';
import type { StatusFilter } from '../Manager';
import {
  Camera,
  CalendarDays,
  Eye,
  Inbox,
  Brain,
  Check,
  CheckCircle,
  WifiOff,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Folder as FolderIcon,
  Maximize2,
  RefreshCw,
} from 'lucide-react';

interface BookmarkListProps {
  bookmarks: Bookmark[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery?: string;
  isBatchMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onViewSnapshot?: (bookmark: Bookmark, initialTab?: string) => void;
  folders?: Folder[];
  domainCounts?: Map<string, number>;
  onDomainClick?: (domain: string) => void;
  onVisit?: (id: string) => void;
  folderStats?: { total: number; healthy: number; dead: number; newSites: number; fraud: number };
  currentFolderName?: string;
  statusFilter?: StatusFilter;
  onStatusFilterChange?: (filter: StatusFilter) => void;
  onRefreshBookmark?: (bookmark: Bookmark) => Promise<void>;
  onDragStart?: (bookmark: Bookmark) => void;
}

interface FolderPath {
  name: string;
  icon: string;
  fullPath: string;
}

interface BookmarkCardProps {
  bookmark: Bookmark;
  isSelected: boolean;
  onSelect: () => void;
  isBatchMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: () => void;
  onViewSnapshot?: () => void;
  folderPath?: FolderPath;
  domainCount?: number;
  onDomainClick?: () => void;
  onVisit?: () => void;
  onRefresh?: () => Promise<void>;
  onDragStart?: () => void;
}

function formatDate(dateString: string | undefined, lang = 'en'): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const locale = lang.startsWith('zh') ? 'zh-CN' : lang.startsWith('ja') ? 'ja-JP' : lang.startsWith('ko') ? 'ko-KR' : undefined;

  if (diffDays === 0) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    const yesterdayMap: Record<string, string> = {
      zh: '昨天', ja: '昨日', ko: '어제', vi: 'Hôm qua', fr: 'Hier',
      de: 'Gestern', es: 'Ayer', pt: 'Ontem', ru: 'Вчера', ar: 'أمس', hi: 'कल',
    };
    const key = Object.keys(yesterdayMap).find(k => lang.startsWith(k));
    return key ? yesterdayMap[key] : 'Yesterday';
  } else if (diffDays < 7) {
    if (lang.startsWith('zh')) return `${diffDays}天前`;
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
}

function truncateSummary(summary: string, maxLength: number = 100): string {
  if (!summary) return '';
  if (summary.length <= maxLength) return summary;
  return summary.substring(0, maxLength).trim() + '...';
}

// Helper to extract domain from URL
function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Helper to get main site URL
function getMainSiteUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}/`;
  } catch {
    return '';
  }
}

// Track in-flight RDAP lookups to avoid duplicate requests
const pendingLookups = new Set<string>();

// Hook to get cached RDAP domain info — auto-triggers lookup if not cached
function useDomainInfo(domain: string): DomainInfo | null {
  const [info, setInfo] = useState<DomainInfo | null>(null);
  useEffect(() => {
    if (!domain) return;
    const key = 'rdap_cache_' + domain;
    chrome.storage.local.get(key).then(result => {
      const cached = result[key];
      if (cached?.data) {
        setInfo(cached.data as DomainInfo);
      } else if (!pendingLookups.has(domain)) {
        // No cache — trigger RDAP lookup in background
        pendingLookups.add(domain);
        chrome.runtime.sendMessage({
          type: 'LOOKUP_DOMAIN_INTELLIGENCE',
          domain,
        }).then(response => {
          if (response?.success && response.data) {
            setInfo(response.data as DomainInfo);
          }
        }).catch(() => {}).finally(() => {
          pendingLookups.delete(domain);
        });
      }
    }).catch(() => {});
  }, [domain]);
  return info;
}

// Format domain age as "1998年注册 已27年" or "Reg. 1998 (27y)"
function formatRegAge(createdDate: string, lang: string): string {
  const created = new Date(createdDate);
  const year = created.getFullYear();
  const ageYears = Math.floor((Date.now() - created.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  if (lang.startsWith('zh')) {
    return `${year}年注册 已${ageYears}年`;
  }
  if (lang.startsWith('vi')) {
    return `ĐK ${year} (${ageYears} năm)`;
  }
  return `Reg. ${year} (${ageYears}y)`;
}

// Quick local trust score calculation (HTTPS + TLD + domain age)
function quickRiskLevel(bookmark: Bookmark, domainInfo: DomainInfo | null): 'safe' | 'caution' | 'danger' | null {
  let score = 50;
  let dataPoints = 1; // HTTPS always counts

  // HTTPS
  if (bookmark.url.startsWith('https:')) score += 10;
  else score -= 20;

  // Domain age
  if (domainInfo?.createdDate) {
    dataPoints++;
    const ageYears = (Date.now() - new Date(domainInfo.createdDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears >= 5) score += 15;
    else if (ageYears >= 1) score += 5;
    else score -= 15;
  }

  // DNSSEC
  if (domainInfo?.dnssec !== undefined) {
    dataPoints++;
    if (domainInfo.dnssec) score += 5;
  }

  // Domain lock
  if (domainInfo?.domainStatus?.some(s => s.includes('Prohibited'))) {
    dataPoints++;
    score += 5;
  }

  // Suspicious TLDs
  const domain = bookmark.domain || '';
  const tld = '.' + (domain.split('.').pop() || '');
  const suspiciousTLDs = ['.xyz', '.top', '.club', '.work', '.click', '.link', '.info', '.buzz', '.gq', '.ml', '.tk', '.cf', '.ga'];
  if (suspiciousTLDs.includes(tld)) { score -= 10; dataPoints++; }

  // Brand regional domain bonus (e.g., hsbc.com.vn)
  if (domain && isKnownBrandRegionalDomain(domain).isBrandRegional) {
    score += 15; dataPoints++;
  }

  if (dataPoints < 2) return null; // Not enough data
  score = Math.max(0, Math.min(100, score));
  if (score >= 70) return 'safe';
  if (score >= 40) return 'caution';
  return 'danger';
}

// Mini trust score badge for card view
function TrustScoreMini({ bookmark, domainInfo, t }: { bookmark: Bookmark; domainInfo: DomainInfo | null; t: (key: string) => string }) {
  // Prefer real-time calculation (has brand-regional fix) over stale stored value
  const riskLevel = quickRiskLevel(bookmark, domainInfo) || bookmark.riskLevel;
  if (!riskLevel) return null;

  const config = {
    safe: { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: t('intelligence.safe') },
    caution: { icon: ShieldAlert, color: 'text-orange-400', bg: 'bg-orange-500/20', label: t('intelligence.caution') },
    danger: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/20', label: t('intelligence.danger') },
  };

  const c = config[riskLevel];
  if (!c) return null;

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${c.bg} ${c.color}`}>
      <c.icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

function BookmarkCard({
  bookmark,
  isSelected,
  onSelect,
  isBatchMode,
  isChecked,
  onToggleCheck,
  onViewSnapshot,
  folderPath,
  domainCount = 0,
  onDomainClick,
  onVisit,
  onRefresh,
  onDragStart,
}: BookmarkCardProps) {
  const { t, i18n } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  // Use bookmark.domain if available, otherwise extract from URL
  const domain = bookmark.domain || getDomainFromUrl(bookmark.url);
  const domainInfo = useDomainInfo(domain);
  const mainSiteUrl = getMainSiteUrl(bookmark.url);

  const handleClick = () => {
    if (isBatchMode && onToggleCheck) {
      onToggleCheck();
    } else {
      onSelect();
    }
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onVisit?.();
    safeOpenUrl(bookmark.url);
  };

  const handleDomainClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDomainClick?.();
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', bookmark.id);
    e.dataTransfer.setData('application/x-bookmark-id', bookmark.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.();
  };

  return (
    <div
      draggable={!isBatchMode}
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={`relative p-4 rounded-xl cursor-pointer transition-all sb-card ${
        isSelected
          ? 'ring-2 ring-violet-500/40 bg-[var(--bg-card-hover)]'
          : isChecked
          ? 'ring-1 ring-violet-500/30 bg-[var(--bg-card-hover)]'
          : 'sb-card-hover'
      } ${bookmark.similarity ? 'border-l-4 border-amber-400' : ''}`}
    >
      {/* Batch Mode Checkbox */}
      {isBatchMode && (
        <div className="absolute top-3 left-3 z-10">
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              isChecked
                ? 'bg-violet-500 border-violet-500 text-white'
                : 'border-[var(--border-secondary)] hover:border-violet-400'
            }`}
          >
            {isChecked && <Check className="w-3 h-3" />}
          </div>
        </div>
      )}

      {/* Similarity Badge */}
      {bookmark.similarity && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-amber-500 text-black text-xs font-bold rounded-full z-10">
          {Math.round(bookmark.similarity.score * 100)}% Similar
        </div>
      )}

      {/* Header: Logo + Title + Domain + Status */}
      <div className={`flex items-start gap-3 ${isBatchMode ? 'ml-7' : ''}`}>
        <img
          src={bookmark.favicon}
          alt=""
          className="w-10 h-10 rounded-lg flex-shrink-0 sb-surface"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>';
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Clickable Title */}
            <h3
              onClick={handleTitleClick}
              className="font-semibold truncate text-sm flex-1 hover:text-violet-400 cursor-pointer transition-colors"
              title={t('action.openOriginal')}
            >
              {bookmark.title}
            </h3>
            <TrustScoreMini bookmark={bookmark} domainInfo={domainInfo} t={t} />
            <StatusBadge status={bookmark.status} onClick={onViewSnapshot} />
          </div>
        </div>
      </div>

      {/* URLs + AI Summary */}
      <div className={`mt-2 space-y-1.5 text-xs ${isBatchMode ? 'ml-7' : ''}`}>
        {/* Main Site URL (clickable - opens homepage) */}
        <div className="flex items-center gap-1.5">
          <span className="sb-muted flex-shrink-0">{t('card.mainSite')}:</span>
          {mainSiteUrl ? (
            <a
              href={mainSiteUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-violet-500 hover:text-violet-400 transition-colors truncate"
              title={mainSiteUrl}
            >
              {mainSiteUrl}
            </a>
          ) : (
            <span className="sb-muted">-</span>
          )}
          {domain && domainCount > 1 && (
            <button
              onClick={handleDomainClick}
              className="sb-muted hover:text-violet-400 transition-colors flex-shrink-0"
              title={t('card.viewSameSite')}
            >
              ({domainCount})
            </button>
          )}
          {domainInfo?.createdDate && (
            <span className="sb-muted flex-shrink-0 text-[10px] opacity-70">
              · {formatRegAge(domainInfo.createdDate, i18n.language)}
            </span>
          )}
        </div>
        {/* Saved URL (clickable - opens in new tab) */}
        <div className="flex items-center gap-1.5">
          <span className="sb-muted flex-shrink-0">{t('card.savedUrl')}:</span>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              onVisit?.();
            }}
            className="sb-secondary hover:text-violet-400 truncate transition-colors"
            title={bookmark.url}
          >
            {bookmark.url}
          </a>
        </div>
        {/* AI Summary */}
        <div className="flex items-start gap-1.5">
          <span className="sb-muted flex-shrink-0">{t('card.aiSummary')}:</span>
          <span className={`leading-relaxed ${bookmark.summary ? 'sb-secondary' : 'sb-muted'}`}>
            {bookmark.summary ? truncateSummary(bookmark.summary) : t('card.noSummary')}
          </span>
        </div>
      </div>

      {/* Tags */}
      {bookmark.tags.length > 0 && (
        <div className={`mt-3 flex gap-1.5 flex-wrap ${isBatchMode ? 'ml-7' : ''}`}>
          {bookmark.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 sb-pill text-xs"
            >
              {tag}
            </span>
          ))}
          {bookmark.tags.length > 3 && (
            <span className="px-2 py-0.5 sb-muted text-xs">
              +{bookmark.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: Metadata */}
      <div className={`mt-3 pt-3 border-t sb-divider space-y-1.5 text-xs ${isBatchMode ? 'ml-7' : ''}`}>
        {/* Row 1: Folder Path + Snapshot Info */}
        <div className="flex items-center justify-between gap-4">
          {folderPath ? (
            <div className="flex items-center gap-1.5 sb-secondary min-w-0 flex-1">
              <FolderIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate" title={folderPath.fullPath}>{folderPath.fullPath}</span>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <span className="flex items-center gap-1.5 sb-muted flex-shrink-0">
            <Camera className="w-3.5 h-3.5" />
            <span>{bookmark.snapshot.level}{bookmark.snapshot.size && bookmark.snapshot.size !== '0 KB' && bookmark.snapshot.size !== '0KB' ? ` · ${bookmark.snapshot.size}` : ''}</span>
          </span>
        </div>

        {/* Row 2: Created Time + Last Visited */}
        <div className="flex items-center justify-between gap-4 sb-muted">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{formatDate(bookmark.createdAt, i18n.language)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            <span>{bookmark.lastVisitedAt ? formatDate(bookmark.lastVisitedAt, i18n.language) : t('detail.neverVisited')}</span>
          </div>
        </div>

        {/* Row 3: Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md sb-button-ghost hover:bg-violet-500/20 hover:text-violet-400 transition-colors sb-muted"
              title={t('intelligence.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-violet-400' : ''}`} />
              <span>{t('intelligence.refresh')}</span>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewSnapshot?.();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md sb-button-ghost hover:bg-violet-500/20 hover:text-violet-400 transition-colors sb-muted"
            title={t('detail.viewSnapshotDetail')}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>{t('detail.viewSnapshotDetail')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Build full folder path (e.g., "Technology > Design System > Sub Category")
function buildFolderPath(folderId: string, folderMap: Map<string, Folder>): FolderPath | undefined {
  const folder = folderMap.get(folderId);
  if (!folder) return undefined;

  const pathParts: { name: string; icon: string }[] = [];
  let current: Folder | undefined = folder;

  // Traverse up to build full path (support up to 3 levels)
  while (current) {
    pathParts.unshift({ name: current.name, icon: current.icon });
    if (current.parentId) {
      current = folderMap.get(current.parentId);
    } else {
      break;
    }
  }

  return {
    name: folder.name,
    icon: pathParts[0]?.icon || 'folder',
    fullPath: pathParts.map(p => p.name).join(' > '),
  };
}

export default function BookmarkList({
  bookmarks,
  selectedId,
  onSelect,
  searchQuery,
  isBatchMode = false,
  selectedIds = new Set(),
  onToggleSelection,
  onViewSnapshot,
  folders = [],
  domainCounts = new Map(),
  onDomainClick,
  onVisit,
  folderStats,
  currentFolderName,
  statusFilter = 'all',
  onStatusFilterChange,
  onRefreshBookmark,
  onDragStart,
}: BookmarkListProps) {
  const { t } = useTranslation();

  // Create folder lookup map
  const folderMap = new Map(folders.map(f => [f.id, f]));

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-20 sb-muted">
        <Inbox className="w-16 h-16 mx-auto mb-4" />
        <p className="text-lg">
          {searchQuery ? t('search.noResults') : 'No bookmarks yet'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Folder Stats Header with Filter Chips */}
      {folderStats && currentFolderName && (
        <div className="mb-4 p-3 sb-card space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">{currentFolderName}</span>
            <span className="text-sm sb-muted">
              {t('stats.total', { count: folderStats.total })}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: 'healthy' as StatusFilter, icon: CheckCircle, label: t('stats.healthy'), count: folderStats.healthy,
                active: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40',
                activeIcon: 'text-emerald-400', activeCount: 'text-emerald-300' },
              { key: 'dead' as StatusFilter, icon: WifiOff, label: t('stats.dead'), count: folderStats.dead,
                active: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40',
                activeIcon: 'text-red-400', activeCount: 'text-red-300' },
              { key: 'new' as StatusFilter, icon: Sparkles, label: t('stats.newSites'), count: folderStats.newSites,
                active: 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40',
                activeIcon: 'text-blue-400', activeCount: 'text-blue-300' },
              { key: 'fraud' as StatusFilter, icon: ShieldAlert, label: t('stats.fraud'), count: folderStats.fraud,
                active: 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40',
                activeIcon: 'text-orange-400', activeCount: 'text-orange-300' },
            ] as const).map(({ key, icon: Icon, label, count, active, activeIcon, activeCount }) => {
              const isActive = statusFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => onStatusFilterChange?.(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive ? active : 'sb-surface sb-muted hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? activeIcon : ''}`} />
                  {label}
                  <span className={`ml-0.5 ${isActive ? activeCount : 'sb-muted'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {searchQuery && (
        <div className="mb-4 text-sm sb-muted flex items-center gap-1.5">
          <Brain className="w-4 h-4" />
          {t('search.results', { count: bookmarks.length })}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {bookmarks.map((bookmark) => {
          const folderPath = buildFolderPath(bookmark.folderId, folderMap);
          const effectiveDomain = bookmark.domain || getDomainFromUrl(bookmark.url);
          return (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              isSelected={selectedId === bookmark.id}
              onSelect={() => onSelect(bookmark.id)}
              isBatchMode={isBatchMode}
              isChecked={selectedIds.has(bookmark.id)}
              onToggleCheck={() => onToggleSelection?.(bookmark.id)}
              onViewSnapshot={() => onViewSnapshot?.(bookmark)}
              folderPath={folderPath}
              domainCount={domainCounts.get(effectiveDomain) || 0}
              onDomainClick={() => onDomainClick?.(effectiveDomain)}
              onVisit={() => onVisit?.(bookmark.id)}
              onRefresh={onRefreshBookmark ? () => onRefreshBookmark(bookmark) : undefined}
              onDragStart={() => onDragStart?.(bookmark)}
            />
          );
        })}
      </div>
    </div>
  );
}
