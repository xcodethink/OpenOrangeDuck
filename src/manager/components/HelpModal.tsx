import { useTranslation } from 'react-i18next';
import {
  Plus,
  Sparkles,
  Search,
  FolderTree,
  HeartPulse,
  GitMerge,
  Import,
  Tags,
  Wand2,
  CloudUpload,
  CheckSquare,
  Calendar,
  X,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StepConfig {
  icon: LucideIcon;
  iconColor: string;
  titleKey: string;
  descKey: string;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const steps: StepConfig[] = [
    { icon: Plus, iconColor: 'text-violet-400', titleKey: 'help.step1Title', descKey: 'help.step1Desc' },
    { icon: Sparkles, iconColor: 'text-amber-400', titleKey: 'help.step2Title', descKey: 'help.step2Desc' },
    { icon: Search, iconColor: 'text-blue-400', titleKey: 'help.step3Title', descKey: 'help.step3Desc' },
    { icon: FolderTree, iconColor: 'text-emerald-400', titleKey: 'help.step4Title', descKey: 'help.step4Desc' },
    { icon: Wand2, iconColor: 'text-purple-400', titleKey: 'help.step5Title', descKey: 'help.step5Desc' },
    { icon: Tags, iconColor: 'text-orange-400', titleKey: 'help.step6Title', descKey: 'help.step6Desc' },
    { icon: Import, iconColor: 'text-teal-400', titleKey: 'help.step7Title', descKey: 'help.step7Desc' },
    { icon: HeartPulse, iconColor: 'text-rose-400', titleKey: 'help.step8Title', descKey: 'help.step8Desc' },
    { icon: GitMerge, iconColor: 'text-cyan-400', titleKey: 'help.step9Title', descKey: 'help.step9Desc' },
    { icon: CheckSquare, iconColor: 'text-indigo-400', titleKey: 'help.step10Title', descKey: 'help.step10Desc' },
    { icon: Calendar, iconColor: 'text-sky-400', titleKey: 'help.step11Title', descKey: 'help.step11Desc' },
    { icon: CloudUpload, iconColor: 'text-pink-400', titleKey: 'help.step12Title', descKey: 'help.step12Desc' },
  ];

  const shortcutKeys: { keys: string; actionKey: string }[] = [
    { keys: 'Ctrl+Shift+S', actionKey: 'help.shortcutSave' },
    { keys: 'Ctrl+Shift+B', actionKey: 'help.shortcutOpen' },
    { keys: 'Ctrl+K', actionKey: 'help.shortcutSearch' },
    { keys: '↑ / ↓', actionKey: 'help.shortcutNavigate' },
    { keys: 'Enter', actionKey: 'help.shortcutOpenSelected' },
    { keys: 'ESC', actionKey: 'help.shortcutClose' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl sb-card rounded-2xl shadow-2xl animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b sb-divider sb-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg sb-surface flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-violet-500" />
              </div>
              <h2 className="text-base font-semibold">{t('help.title')}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg sb-button-ghost sb-muted hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Usage steps */}
          <div>
            <h3 className="text-xs font-medium sb-muted uppercase tracking-wider mb-3">
              {t('help.gettingStarted')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {steps.map((step, i) => {
                const IconComponent = step.icon;
                return (
                  <div key={i} className="p-3 sb-card rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg sb-surface flex items-center justify-center flex-shrink-0">
                        <IconComponent className={`w-4 h-4 ${step.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm mb-0.5">{t(step.titleKey)}</h4>
                        <p className="text-xs sb-muted leading-relaxed">{t(step.descKey)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shortcuts */}
          <div>
            <h3 className="text-xs font-medium sb-muted uppercase tracking-wider mb-3">
              {t('help.shortcuts')}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {shortcutKeys.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 sb-card rounded-lg">
                  <kbd className="px-2 py-1 sb-input rounded text-xs font-mono sb-secondary">
                    {s.keys}
                  </kbd>
                  <span className="text-xs sb-muted">{t(s.actionKey)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Snapshot levels */}
          <div>
            <h3 className="text-xs font-medium sb-muted uppercase tracking-wider mb-3">
              {t('help.snapshotLevels')}
            </h3>
            <div className="space-y-2">
              <div className="p-3 sb-card rounded-lg flex items-center gap-3">
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                  {t('snapshot.L1')}
                </span>
                <span className="sb-muted text-xs">{t('help.snapshotL1Desc')}</span>
              </div>
              <div className="p-3 sb-card rounded-lg flex items-center gap-3">
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                  {t('snapshot.L2')}
                </span>
                <span className="sb-muted text-xs">{t('help.snapshotL2Desc')}</span>
              </div>
              <div className="p-3 sb-card rounded-lg flex items-center gap-3">
                <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded text-xs font-medium">
                  {t('snapshot.L3')}
                </span>
                <span className="sb-muted text-xs">{t('help.snapshotL3Desc')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
