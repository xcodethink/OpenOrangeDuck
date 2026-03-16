import { useTranslation } from 'react-i18next';
import {
  BookMarked,
  Search,
  FolderOpen,
  Tag,
  Calendar,
  MousePointer,
  Keyboard,
  Import,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';

interface EmptyStateProps {
  type: 'bookmarks' | 'search' | 'folder' | 'tags' | 'timeline';
  onAction?: () => void;
  actionLabel?: string;
}

interface TipConfig {
  icon: LucideIcon;
  text: string;
}

interface EmptyConfig {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  tips: TipConfig[];
}

export default function EmptyState({ type, onAction, actionLabel }: EmptyStateProps) {
  const { t } = useTranslation();

  const configs: Record<string, EmptyConfig> = {
    bookmarks: {
      icon: BookMarked,
      iconBg: 'from-violet-500/20 to-fuchsia-500/20',
      iconColor: 'text-violet-400',
      title: t('empty.bookmarks.title'),
      description: t('empty.bookmarks.description'),
      tips: [
        { icon: MousePointer, text: t('empty.bookmarks.tip1') },
        { icon: Keyboard, text: t('empty.bookmarks.tip2') },
        { icon: Import, text: t('empty.bookmarks.tip3') },
      ],
    },
    search: {
      icon: Search,
      iconBg: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-400',
      title: t('empty.search.title'),
      description: t('empty.search.description'),
      tips: [
        { icon: Lightbulb, text: t('empty.search.tip1') },
        { icon: Tag, text: t('empty.search.tip2') },
      ],
    },
    folder: {
      icon: FolderOpen,
      iconBg: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-400',
      title: t('empty.folder.title'),
      description: t('empty.folder.description'),
      tips: [],
    },
    tags: {
      icon: Tag,
      iconBg: 'from-emerald-500/20 to-teal-500/20',
      iconColor: 'text-emerald-400',
      title: t('empty.tags.title'),
      description: t('empty.tags.description'),
      tips: [],
    },
    timeline: {
      icon: Calendar,
      iconBg: 'from-rose-500/20 to-pink-500/20',
      iconColor: 'text-rose-400',
      title: t('empty.timeline.title'),
      description: t('empty.timeline.description'),
      tips: [],
    },
  };

  const config = configs[type];
  const IconComponent = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Icon */}
      <div className="w-14 h-14 rounded-xl sb-card flex items-center justify-center mb-5">
        <IconComponent className={`w-7 h-7 ${config.iconColor}`} />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold mb-2">{config.title}</h3>

      {/* Description */}
      <p className="sb-muted text-sm max-w-md mb-6">{config.description}</p>

      {/* Tips */}
      {config.tips.length > 0 && (
        <div className="sb-card rounded-xl p-4 mb-6 max-w-sm w-full">
          <div className="text-xs sb-muted uppercase tracking-wider mb-3 font-medium">
            {t('empty.quickStart')}
          </div>
          <ul className="space-y-3 text-left">
            {config.tips.map((tip, i) => {
              const TipIcon = tip.icon;
              return (
                <li key={i} className="flex items-center gap-3 text-sm sb-secondary">
                  <div className="w-7 h-7 rounded-lg sb-surface flex items-center justify-center flex-shrink-0">
                    <TipIcon className="w-3.5 h-3.5 sb-muted" />
                  </div>
                  <span>{tip.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Action Button */}
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="px-4 py-2 sb-button rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Import className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// 简单版空状态
export function SimpleEmptyState({
  icon: IconComponent,
  message,
}: {
  icon: LucideIcon;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 sb-muted">
      <div className="w-12 h-12 rounded-xl sb-card flex items-center justify-center mb-3">
        <IconComponent className="w-6 h-6 sb-muted" />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
