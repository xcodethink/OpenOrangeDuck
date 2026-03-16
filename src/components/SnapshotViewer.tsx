import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Bookmark, SnapshotLevel } from '../types';
import { safeOpenUrl } from '../utils/url';
import { buildReaderModeDocument } from '../utils/readerMode';
import WebsiteIntelligence from './WebsiteIntelligence';
import {
  X,
  FileText,
  Globe,
  Copy,
  ExternalLink,
  Image,
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react';

type TabType = 'overview' | 'L1' | 'L2' | 'L3';

interface SnapshotViewerProps {
  bookmark: Bookmark;
  onClose: () => void;
  initialTab?: TabType;
  onUpdateSnapshot?: (level: SnapshotLevel) => void;
  updatingLevel?: SnapshotLevel | null;
}

export default function SnapshotViewer({ bookmark, onClose, initialTab = 'overview', onUpdateSnapshot, updatingLevel }: SnapshotViewerProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Detect current theme
  const isDark = !document.documentElement.classList.contains('light');
  const theme = isDark ? 'dark' as const : 'light' as const;

  const levelLabels: Record<string, { label: string; color: string }> = {
    L1: { label: t('snapshot.L1'), color: 'emerald' },
    L2: { label: t('snapshot.L2'), color: 'blue' },
    L3: { label: t('snapshot.L3'), color: 'violet' },
  };

  const levelInfo = levelLabels[bookmark.snapshot.level] || levelLabels.L1;

  const tabs: { key: TabType; label: string; icon: React.ElementType; color?: string }[] = [
    { key: 'overview', label: t('snapshot.overview'), icon: LayoutDashboard },
    { key: 'L1', label: t('snapshot.L1'), icon: FileText, color: 'emerald' },
    { key: 'L2', label: t('snapshot.L2'), icon: Image, color: 'blue' },
    { key: 'L3', label: t('snapshot.L3'), icon: Globe, color: 'violet' },
  ];

  // Pre-build reader mode document for L2 (rich HTML with images)
  const readerDocL2 = useMemo(() => {
    if (!bookmark.content.html) return null;
    return buildReaderModeDocument({
      html: bookmark.content.html,
      title: bookmark.title,
      theme,
      showImages: true,
    });
  }, [bookmark.content.html, bookmark.title, theme]);

  const levelValue: Record<string, number> = { L1: 1, L2: 2, L3: 3 };
  const currentLevelValue = levelValue[bookmark.snapshot.level] || 1;

  const renderRefreshBar = (level: SnapshotLevel) => {
    const hasData = currentLevelValue >= (levelValue[level] || 1);
    const isUpdating = updatingLevel === level;
    return (
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs sb-muted">
          {hasData
            ? `${t('snapshot.savedAt')}: ${new Date(bookmark.snapshot.createdAt || bookmark.createdAt).toLocaleString()}`
            : t('snapshot.noContent')}
        </span>
        {onUpdateSnapshot && (
          <button
            onClick={() => onUpdateSnapshot(level)}
            disabled={!!updatingLevel}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg sb-button transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? t('snapshot.updating') : t('snapshot.refreshSnapshot')}
          </button>
        )}
      </div>
    );
  };

  // Fallback: plain text rendering for old bookmarks
  const renderPlainTextFallback = (maxHeight: string) => (
    <div className="sb-card rounded-lg p-4">
      <h3 className="text-sm font-semibold sb-muted mb-2 flex items-center gap-2">
        <FileText className="w-4 h-4" /> {t('snapshot.originalText')}
      </h3>
      <div className={`sb-secondary text-sm leading-relaxed whitespace-pre-wrap overflow-auto`} style={{ maxHeight }}>
        {bookmark.content.text || t('snapshot.noContent')}
      </div>
    </div>
  );

  // Fallback: image gallery for old bookmarks
  const renderImageGalleryFallback = () => {
    if (!bookmark.content.images || bookmark.content.images.length === 0) return null;
    return (
      <div>
        <h3 className="text-sm font-semibold sb-muted mb-2 flex items-center gap-2">
          <Image className="w-4 h-4" /> {t('snapshot.images')} ({bookmark.content.images.length})
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {bookmark.content.images.slice(0, 12).map((img, idx) => (
            <div key={idx} className="aspect-video sb-card rounded-lg overflow-hidden">
              <img
                src={img}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="sb-card rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sb-divider">
          <div className="flex items-center gap-3">
            <img
              src={bookmark.favicon}
              alt=""
              className="w-6 h-6 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>';
              }}
            />
            <div>
              <h2 className="font-semibold truncate max-w-md">{bookmark.title}</h2>
              <p className="text-xs sb-muted truncate max-w-md">{bookmark.url}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                levelInfo.color === 'emerald'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : levelInfo.color === 'blue'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-violet-500/20 text-violet-400'
              }`}
            >
              {levelInfo.label} • {bookmark.snapshot.size}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg sb-button-ghost sb-muted hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b sb-divider">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'text-violet-500 border-b-2 border-violet-400'
                    : 'sb-muted hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'overview' ? (
            <WebsiteIntelligence bookmark={bookmark} isPremium={true} />

          ) : activeTab === 'L1' ? (
            // L1: Plain text content (no HTML formatting, no images)
            <div className="space-y-4">
              {renderRefreshBar('L1')}
              {bookmark.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {bookmark.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 sb-pill rounded-full text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              {renderPlainTextFallback('60vh')}
            </div>

          ) : activeTab === 'L2' ? (
            // L2: Reader mode with images
            <div className="space-y-4">
              {renderRefreshBar('L2')}
              {bookmark.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {bookmark.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 sb-pill rounded-full text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              {readerDocL2 ? (
                <div className="rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={readerDocL2}
                    title="Reader Mode with Images"
                    className="w-full border-0"
                    style={{ minHeight: '500px', height: '60vh' }}
                    sandbox="allow-same-origin"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {renderPlainTextFallback('24rem')}
                  {renderImageGalleryFallback()}
                </div>
              )}
            </div>

          ) : (
            // L3: Screenshot view with fallbacks
            <div className="space-y-4">
              {renderRefreshBar('L3')}
              {bookmark.content.screenshot ? (
                <div className="rounded-lg overflow-auto max-h-[65vh] sb-card">
                  <img
                    src={bookmark.content.screenshot}
                    alt="Page Screenshot"
                    className="w-full"
                  />
                </div>
              ) : readerDocL2 ? (
                <div className="rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={readerDocL2}
                    title="Full Snapshot"
                    className="w-full border-0"
                    style={{ minHeight: '500px', height: '60vh' }}
                    sandbox="allow-same-origin"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {renderPlainTextFallback('24rem')}
                  {renderImageGalleryFallback()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t sb-divider text-xs sb-muted">
          <span>
            {t('snapshot.savedAt')}: {new Date(bookmark.createdAt).toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(bookmark.content.text || '');
              }}
              className="px-3 py-1.5 sb-button rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Copy className="w-4 h-4" /> {t('action.copy')}
            </button>
            <button
              onClick={() => safeOpenUrl(bookmark.url)}
              className="px-3 py-1.5 sb-button-primary rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" /> {t('action.openOriginal')}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 sb-button rounded-lg transition-colors flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> {t('shortcuts.closeModal')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
