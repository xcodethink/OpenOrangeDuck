import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Calendar,
  LayoutGrid,
  HeartPulse,
  GitMerge,
  Import,
  Tags,
  Wand2,
  CheckSquare,
  Settings,
  CloudUpload,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface FeatureButtonsProps {
  onHelpClick: () => void;
  isTimelineView: boolean;
  onToggleView: () => void;
  onHealthCheck: () => void;
  isChecking: boolean;
  onImportExportClick?: () => void;
  onCloudBackupClick?: () => void;
  onBatchModeClick?: () => void;
  isBatchMode?: boolean;
}

export default function FeatureButtons({
  onHelpClick,
  isTimelineView,
  onToggleView,
  onHealthCheck,
  isChecking,
  onImportExportClick,
  onCloudBackupClick,
  onBatchModeClick,
  isBatchMode,
}: FeatureButtonsProps) {
  const { t } = useTranslation();

  const openDedupePage = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dedupe/index.html') });
  };

  const openTagsPage = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/tags/index.html') });
  };

  const openClassifyPage = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/classify/index.html') });
  };

  const openSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  const features = [
    {
      id: 'help',
      icon: BookOpen,
      label: t('feature.guide'),
      onClick: onHelpClick,
    },
    {
      id: 'timeline',
      icon: isTimelineView ? LayoutGrid : Calendar,
      label: isTimelineView ? t('feature.cardView') : t('feature.timeline'),
      onClick: onToggleView,
      active: isTimelineView,
    },
    {
      id: 'health',
      icon: HeartPulse,
      label: isChecking ? t('feature.checking') : t('feature.healthCheck'),
      onClick: onHealthCheck,
      disabled: isChecking,
    },
    {
      id: 'dedupe',
      icon: GitMerge,
      label: t('feature.dedupe'),
      onClick: openDedupePage,
    },
    {
      id: 'import',
      icon: Import,
      label: t('feature.import'),
      onClick: onImportExportClick,
    },
    {
      id: 'tags',
      icon: Tags,
      label: t('feature.tags'),
      onClick: openTagsPage,
    },
    {
      id: 'classify',
      icon: Wand2,
      label: t('feature.classify'),
      onClick: openClassifyPage,
    },
    {
      id: 'cloudBackup',
      icon: CloudUpload,
      label: t('feature.cloudBackup'),
      onClick: onCloudBackupClick,
    },
    {
      id: 'batch',
      icon: CheckSquare,
      label: t('feature.batchSelect'),
      onClick: onBatchModeClick,
      active: isBatchMode,
    },
    {
      id: 'settings',
      icon: Settings,
      label: t('feature.settings'),
      onClick: openSettings,
    },
  ].filter(f => f.onClick);

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {features.map((f) => {
        const Icon = f.icon;
        return (
          <button
            key={f.id}
            onClick={f.onClick}
            disabled={f.disabled}
            className={cn(
              'sb-button px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5',
              f.active
                ? 'bg-violet-600 text-white border-violet-500/40'
                : 'sb-secondary',
              f.disabled && 'opacity-60 cursor-not-allowed'
            )}
          >
            <Icon className={cn('w-3.5 h-3.5', f.disabled && 'animate-spin')} />
            <span>{f.label}</span>
          </button>
        );
      })}
    </div>
  );
}
