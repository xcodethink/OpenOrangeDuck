import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  const { t } = useTranslation();
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    {
      category: t('shortcuts.general'),
      items: [
        { keys: [modKey, 'Shift', 'S'], desc: t('shortcuts.quickSave') },
        { keys: [modKey, 'K'], desc: t('shortcuts.search') },
        { keys: ['Esc'], desc: t('shortcuts.closeModal') },
        { keys: ['?'], desc: t('shortcuts.showHelp') },
      ],
    },
    {
      category: t('shortcuts.navigation'),
      items: [
        { keys: ['↑', '↓'], desc: t('shortcuts.navigateList') },
        { keys: ['Enter'], desc: t('shortcuts.openSelected') },
        { keys: [modKey, 'Enter'], desc: t('shortcuts.openInNewTab') },
      ],
    },
    {
      category: t('shortcuts.actions'),
      items: [
        { keys: [modKey, 'D'], desc: t('shortcuts.delete') },
        { keys: [modKey, 'E'], desc: t('shortcuts.edit') },
        { keys: [modKey, 'C'], desc: t('shortcuts.copyUrl') },
        { keys: [modKey, 'A'], desc: t('shortcuts.selectAll') },
      ],
    },
    {
      category: t('shortcuts.view'),
      items: [
        { keys: ['1'], desc: t('shortcuts.gridView') },
        { keys: ['2'], desc: t('shortcuts.listView') },
        { keys: ['3'], desc: t('shortcuts.timelineView') },
      ],
    },
  ];

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="sb-card rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sb-divider">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-violet-500" />
            {t('shortcuts.title')}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg sb-button-ghost sb-muted hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-auto max-h-[calc(80vh-120px)]">
          <div className="grid grid-cols-2 gap-6">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="text-sm font-semibold text-violet-400 mb-3">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm sb-secondary">{item.desc}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((key, j) => (
                          <span key={j}>
                            <kbd className="px-2 py-1 sb-input rounded text-xs font-mono sb-secondary shadow-sm">
                              {key}
                            </kbd>
                            {j < item.keys.length - 1 && (
                              <span className="sb-muted mx-0.5">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t sb-divider sb-surface">
          <p className="text-xs sb-muted text-center">
            {t('shortcuts.hint', { key: '?' })}
          </p>
        </div>
      </div>
    </div>
  );
}

// 快捷键提示小组件（显示在角落）
export function ShortcutHint() {
  const [show, setShow] = useState(false);

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <button
        onClick={() => setShow(!show)}
        className="p-2 sb-card sb-card-hover rounded-lg sb-muted hover:text-[var(--text-primary)] transition-all backdrop-blur-sm"
        title="Keyboard Shortcuts"
      >
        <Keyboard className="w-4 h-4" />
      </button>
    </div>
  );
}
