import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Bookmark, SnapshotLevel } from '../../types';
import { formatDateFull, getRelativeTime } from '../../utils/date';
import { safeOpenUrl } from '../../utils/url';
import { toast } from '../../components/Toast';
import StatusBadge from '../../components/StatusBadge';
import TranslatableText from '../../components/TranslatableText';
import {
  X,
  ExternalLink,
  Copy,
  Camera,
  Bot,
  Tag,
  Clock,
  CalendarDays,
  RefreshCw,
  Check,
  Loader2,
  FileText,
  Sparkles,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';

interface DetailPanelProps {
  bookmark: Bookmark | undefined;
  onClose: () => void;
  onViewSnapshot?: (bookmark: Bookmark, initialTab?: string) => void;
  onSnapshotUpdated?: () => void;
  onDelete?: (id: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
}

function SnapshotBadge({ level, size }: { level: string; size: string }) {
  const { t } = useTranslation();

  const config: Record<string, { color: string }> = {
    L1: { color: 'emerald' },
    L2: { color: 'blue' },
    L3: { color: 'violet' },
  };

  const c = config[level] || config.L1;

  const bgColors: Record<string, string> = {
    emerald: 'bg-emerald-500/20',
    blue: 'bg-blue-500/20',
    violet: 'bg-violet-500/20',
  };

  const textColors: Record<string, string> = {
    emerald: 'text-emerald-300',
    blue: 'text-blue-300',
    violet: 'text-violet-300',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bgColors[c.color]} ${textColors[c.color]}`}
    >
      <Camera className="w-3 h-3" /> {t(`snapshot.${level}`)} · {size}
    </span>
  );
}

export default function DetailPanel({ bookmark, onClose, onViewSnapshot, onSnapshotUpdated, onDelete, onUpdateTitle }: DetailPanelProps) {
  const { t, i18n } = useTranslation();
  const [updatingLevel, setUpdatingLevel] = useState<SnapshotLevel | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const handleEnrichBookmark = async () => {
    if (!bookmark || isEnriching) return;

    setIsEnriching(true);
    const toastId = toast.info(t('detail.enriching'));

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ENRICH_BOOKMARK',
        bookmarkId: bookmark.id,
      });

      toast.dismiss(toastId);
      if (response.success) {
        toast.success(t('detail.enrichSuccess'));
        onSnapshotUpdated?.();
      } else {
        const errKey = response.error;
        const translated = t(`errors.${errKey}`, { defaultValue: '' });
        toast.error(translated || (t('detail.enrichError') + ': ' + (errKey || '')));
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(t('detail.enrichError'));
    } finally {
      setIsEnriching(false);
    }
  };

  const handleUpdateSnapshot = async (level: SnapshotLevel) => {
    if (!bookmark || updatingLevel) return;

    setUpdatingLevel(level);
    toast.info(t('snapshot.updating'));

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SNAPSHOT',
        bookmarkId: bookmark.id,
        level,
      });

      if (response.success) {
        toast.success(t('snapshot.updateSuccess'));
        onSnapshotUpdated?.();
      } else {
        toast.error(t('snapshot.updateError') + ': ' + (response.error || ''));
      }
    } catch (error) {
      toast.error(t('snapshot.updateError'));
    } finally {
      setUpdatingLevel(null);
    }
  };

  const handleCopyUrl = () => {
    if (bookmark) {
      navigator.clipboard.writeText(bookmark.url);
      toast.success(t('action.copy') + ' ' + t('common.success'));
    }
  };

  const handleOpenUrl = () => {
    if (bookmark) {
      safeOpenUrl(bookmark.url);
    }
  };

  const handleStartEditTitle = () => {
    if (bookmark) {
      setEditTitle(bookmark.title);
      setIsEditingTitle(true);
    }
  };

  const handleSaveTitle = () => {
    if (bookmark && editTitle.trim() && editTitle.trim() !== bookmark.title) {
      onUpdateTitle?.(bookmark.id, editTitle.trim());
      toast.success(t('common.success'));
    }
    setIsEditingTitle(false);
  };

  const handleDeleteBookmark = () => {
    if (!bookmark) return;
    if (!confirm(t('detail.deleteConfirm'))) return;
    onDelete?.(bookmark.id);
  };

  if (!bookmark) {
    return (
      <div className="w-96 sb-surface border-l sb-divider flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-violet-400" />
          </div>
          <p className="text-sm sb-muted">{t('detail.selectHint')}</p>
        </div>
      </div>
    );
  }

  const hasSummary = bookmark.summary && bookmark.summary.length > 0;
  const hasTags = bookmark.tags.length > 0 && !(bookmark.tags.length === 1 && bookmark.tags[0] === 'uncategorized');
  const hasContentText = bookmark.content.text && bookmark.content.text.length > 0;
  const needsEnrichment = !hasSummary || !hasTags;
  const contentPreviewLength = 500;

  return (
    <div className="w-96 sb-surface border-l sb-divider flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b sb-divider flex items-center justify-between">
        <h3 className="font-semibold">{t('detail.title')}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleEnrichBookmark}
            disabled={isEnriching}
            className={`p-1.5 rounded-lg transition-colors ${
              needsEnrichment
                ? 'text-violet-400 hover:text-violet-300 hover:bg-violet-500/10'
                : 'sb-muted hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
            title={t('detail.enrichTooltip')}
          >
            {isEnriching ? (
              <Loader2 className="w-4.5 h-4.5 animate-spin" />
            ) : (
              <Sparkles className="w-4.5 h-4.5" />
            )}
          </button>
          <button onClick={onClose} className="p-1.5 sb-muted hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Basic Info */}
        <div className="p-6 border-b sb-divider">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={bookmark.favicon}
              alt=""
              className="w-10 h-10 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>';
              }}
            />
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  autoFocus
                  className="w-full text-lg font-bold mb-1 bg-transparent border-b-2 border-violet-500 outline-none"
                />
              ) : (
                <h2
                  className="text-lg font-bold mb-1 truncate cursor-pointer hover:text-violet-400 transition-colors"
                  onClick={handleStartEditTitle}
                  title={t('detail.clickToEditTitle')}
                >
                  {bookmark.title}
                </h2>
              )}
              <a
                href={bookmark.url}
                className="text-xs text-violet-500 hover:underline block truncate"
                target="_blank"
                rel="noreferrer"
              >
                {bookmark.url}
              </a>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatusBadge status={bookmark.status} />
            <SnapshotBadge level={bookmark.snapshot.level} size={bookmark.snapshot.size} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-b sb-divider flex gap-2">
          <button
            onClick={handleOpenUrl}
            className="sb-button-primary flex-1 px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-4 h-4" /> {t('action.openOriginal')}
          </button>
          <button
            onClick={handleCopyUrl}
            className="sb-button flex-1 px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Copy className="w-4 h-4" /> {t('action.copy')}
          </button>
          <button
            onClick={handleStartEditTitle}
            className="sb-button px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
            title={t('common.edit')}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteBookmark}
            className="px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* AI Summary */}
        <div className="p-6 border-b sb-divider">
          <h3 className="text-xs font-semibold sb-muted uppercase mb-3 tracking-wider flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" /> {t('detail.summary')}
          </h3>
          {hasSummary ? (
            <TranslatableText
              text={bookmark.summary}
              bookmarkId={bookmark.id}
              field="summary"
              cachedTranslation={bookmark.translations?.summary?.[i18n.language.split('-')[0]]}
              className="text-sm sb-secondary leading-relaxed"
            />
          ) : (
            <button
              onClick={handleEnrichBookmark}
              disabled={isEnriching}
              className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1.5 transition-colors"
            >
              {isEnriching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {t('detail.clickToEnrich')}
            </button>
          )}
        </div>

        {/* Tags */}
        <div className="p-6 border-b sb-divider">
          <h3 className="text-xs font-semibold sb-muted uppercase mb-3 tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> {t('detail.tags')}
          </h3>
          <div className="flex gap-2 flex-wrap">
            {hasTags ? (
              bookmark.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 sb-pill text-sm font-medium"
                >
                  {tag}
                </span>
              ))
            ) : (
              <button
                onClick={handleEnrichBookmark}
                disabled={isEnriching}
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1.5 transition-colors"
              >
                {isEnriching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {t('detail.clickToEnrich')}
              </button>
            )}
          </div>
        </div>

        {/* Content Preview (inline snapshot content) */}
        {hasContentText && (
          <div className="p-6 border-b sb-divider">
            <h3 className="text-xs font-semibold sb-muted uppercase mb-3 tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> {t('detail.contentPreview')}
            </h3>
            <TranslatableText
              text={bookmark.content.text!}
              bookmarkId={bookmark.id}
              field="content"
              cachedTranslation={bookmark.translations?.content?.[i18n.language.split('-')[0]]}
              className="text-sm sb-secondary leading-relaxed whitespace-pre-wrap"
              maxLength={contentPreviewLength}
              expandable
            />
          </div>
        )}

        {/* Timestamps */}
        <div className="p-6 border-b sb-divider">
          <h3 className="text-xs font-semibold sb-muted uppercase mb-3 tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {t('detail.timestamps')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 sb-card">
              <CalendarDays className="w-6 h-6 sb-muted" />
              <div>
                <p className="text-xs sb-muted">{t('detail.addedAt')}</p>
                <p className="text-sm sb-secondary font-medium">
                  {formatDateFull(bookmark.createdAt, i18n.language)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 sb-card">
              <RefreshCw className="w-6 h-6 sb-muted" />
              <div>
                <p className="text-xs sb-muted">{t('detail.refreshedAt')}</p>
                <p className="text-sm sb-secondary font-medium">
                  {formatDateFull(bookmark.refreshedAt, i18n.language)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Snapshot Level Upgrade */}
        <div className="p-6">
          <h3 className="text-xs font-semibold sb-muted uppercase mb-3 tracking-wider flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" /> {t('detail.snapshotLevel')}
          </h3>
          <div className="space-y-2">
            {[
              { level: 'L1' as SnapshotLevel, color: 'emerald' },
              { level: 'L2' as SnapshotLevel, color: 'blue' },
              { level: 'L3' as SnapshotLevel, color: 'violet' },
            ].map((item) => {
              const levelValue: Record<SnapshotLevel, number> = { L1: 1, L2: 2, L3: 3 };
              const hasData = levelValue[bookmark.snapshot.level] >= levelValue[item.level];
              const isCurrent = bookmark.snapshot.level === item.level;
              const isUpdating = updatingLevel === item.level;

              return (
                <div
                  key={item.level}
                  className={`p-3 rounded-lg transition-all ${
                    hasData
                      ? item.color === 'emerald'
                        ? 'bg-emerald-500/20 ring-1 ring-emerald-500/30'
                        : item.color === 'blue'
                        ? 'bg-blue-500/20 ring-1 ring-blue-500/30'
                        : 'bg-violet-500/20 ring-1 ring-violet-500/30'
                      : 'sb-card sb-card-hover'
                  } ${isUpdating ? 'animate-pulse' : ''}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm font-medium ${
                          hasData
                            ? item.color === 'emerald'
                              ? 'text-emerald-300'
                              : item.color === 'blue'
                              ? 'text-blue-300'
                              : 'text-violet-300'
                            : 'sb-muted'
                        }`}
                      >
                        {t(`snapshot.${item.level}`)}
                      </span>
                      {hasData && bookmark.snapshot.createdAt && (
                        <span className="text-[10px] sb-muted">
                          {getRelativeTime(bookmark.snapshot.createdAt, i18n.language)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewSnapshot?.(bookmark, item.level);
                        }}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                        title={t('detail.viewSnapshotDetail')}
                      >
                        <Eye className={`w-3.5 h-3.5 ${
                          hasData
                            ? item.color === 'emerald'
                              ? 'text-emerald-400'
                              : item.color === 'blue'
                              ? 'text-blue-400'
                              : 'text-violet-400'
                            : 'sb-muted hover:text-violet-400'
                        }`} />
                      </button>
                      {isCurrent && (
                        <span
                          className={`text-xs font-semibold flex items-center gap-1 ${
                            item.color === 'emerald'
                              ? 'text-emerald-400'
                              : item.color === 'blue'
                              ? 'text-blue-400'
                              : 'text-violet-400'
                          }`}
                        >
                          <Check className="w-3 h-3" /> {t('snapshot.current')}
                        </span>
                      )}
                      {isUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 sb-muted animate-spin" />
                      ) : (
                        <button
                          onClick={() => handleUpdateSnapshot(item.level)}
                          className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                          title={t('snapshot.update')}
                        >
                          <RefreshCw className="w-3.5 h-3.5 sb-muted hover:text-violet-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
