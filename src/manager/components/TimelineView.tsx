import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Bookmark } from '../../types';
import type { Folder } from '../../types/folder';
import { formatDate, formatDay, dayKey } from '../../utils/date';
import { Check, CheckCircle2, Camera, Loader2, Inbox, FolderIcon } from 'lucide-react';

interface TimelineViewProps {
  bookmarks: Bookmark[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isBatchMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  folders?: Folder[];
}

interface TimelineCardProps {
  bookmark: Bookmark;
  isSelected: boolean;
  onSelect: () => void;
  isBatchMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: () => void;
  folderName?: string;
}

function StatusBadge({ status }: { status: Bookmark['status'] }) {
  const { t } = useTranslation();

  const config: Record<string, { icon: ReactNode; color: string; label: string }> = {
    healthy: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'blue', label: t('status.healthy') },
    dead: { icon: <Camera className="w-3.5 h-3.5" />, color: 'red', label: t('status.dead') },
    checking: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: 'amber', label: t('status.checking') },
  };

  const c = config[status] || config.healthy;

  const bgColors: Record<string, string> = {
    blue: 'bg-blue-500/30',
    red: 'bg-red-500/30',
    amber: 'bg-amber-500/30',
  };

  const textColors: Record<string, string> = {
    blue: 'text-blue-300',
    red: 'text-red-300',
    amber: 'text-amber-300',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bgColors[c.color]} ${textColors[c.color]}`}
    >
      <span>{c.icon}</span>
      {c.label}
    </span>
  );
}

function TimelineCard({ bookmark, isSelected, onSelect, isBatchMode, isChecked, onToggleCheck, folderName }: TimelineCardProps) {
  const { i18n } = useTranslation();

  const handleClick = () => {
    if (isBatchMode && onToggleCheck) {
      onToggleCheck();
    } else {
      onSelect();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative flex gap-4 p-3 rounded-lg cursor-pointer transition-all sb-card ${
        isBatchMode && isChecked
          ? 'bg-violet-600/40 ring-1 ring-violet-500'
          : isSelected
          ? 'bg-violet-600/40'
          : 'sb-card-hover'
      }`}
    >
      {/* Checkbox for batch mode */}
      {isBatchMode && (
        <div className="flex items-center">
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isChecked
                ? 'bg-violet-500 border-violet-500'
                : 'border-[var(--border-secondary)] hover:border-violet-400'
            }`}
          >
            {isChecked && <Check className="w-3 h-3 text-white" />}
          </div>
        </div>
      )}

      <img
        src={bookmark.favicon}
        alt=""
        className="w-6 h-6 rounded mt-0.5"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>';
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate text-sm">{bookmark.title}</h3>
          <StatusBadge status={bookmark.status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-xs sb-muted truncate">{bookmark.url}</p>
        </div>
        {folderName && (
          <div className="flex items-center gap-1 mt-1">
            <FolderIcon className="w-3 h-3 text-violet-400/70" />
            <span className="text-xs text-violet-300/70">{folderName}</span>
          </div>
        )}
      </div>
      <div className="text-xs sb-muted whitespace-nowrap">{formatDate(bookmark.createdAt, i18n.language)}</div>
    </div>
  );
}

export default function TimelineView({
  bookmarks,
  selectedId,
  onSelect,
  isBatchMode = false,
  selectedIds = new Set(),
  onToggleSelection,
  folders = [],
}: TimelineViewProps) {
  const { t, i18n } = useTranslation();

  const folderMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of folders) {
      if (f.id !== 'all') map[f.id] = f.name;
    }
    return map;
  }, [folders]);

  const groupedByDay = useMemo(() => {
    const groups: Record<string, Bookmark[]> = {};

    bookmarks.forEach((b) => {
      const key = dayKey(b.createdAt);
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    });

    // Sort within each day (newest first)
    Object.keys(groups).forEach((key) => {
      groups[key].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return groups;
  }, [bookmarks]);

  const days = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-20 sb-muted">
        <Inbox className="w-12 h-12 mx-auto mb-4 sb-muted" />
        <p className="text-lg">{t('common.noData', 'No bookmarks yet')}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-500 via-fuchsia-500 to-blue-500" />

      <div className="space-y-6">
        {days.map((day) => (
          <div key={day} className="relative pl-10">
            {/* Timeline dot */}
            <div className="absolute left-2 w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 border-4 border-[var(--bg-primary)]" />

            <div className="mb-3">
              <h3 className="font-bold text-fuchsia-300">{formatDay(groupedByDay[day][0].createdAt, i18n.language)}</h3>
              <span className="text-xs sb-muted">
                {groupedByDay[day].length} bookmarks
              </span>
            </div>

            <div className="space-y-2">
              {groupedByDay[day].map((bookmark) => (
                <TimelineCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  isSelected={selectedId === bookmark.id}
                  onSelect={() => onSelect(bookmark.id)}
                  isBatchMode={isBatchMode}
                  isChecked={selectedIds.has(bookmark.id)}
                  onToggleCheck={() => onToggleSelection?.(bookmark.id)}
                  folderName={folderMap[bookmark.folderId]}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
