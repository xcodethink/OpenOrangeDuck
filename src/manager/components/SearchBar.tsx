import { useTranslation } from 'react-i18next';
import { Search, X, Sparkles } from 'lucide-react';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import { cn } from '../../utils/cn';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  const { t } = useTranslation();
  const { isSemanticMode, setSemanticMode } = useBookmarkStore();

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="w-4 h-4 sb-muted" />
        </div>
        <input
          type="text"
          placeholder={isSemanticMode ? t('search.semanticPlaceholder') : t('search.placeholder')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 sb-input text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute inset-y-0 right-3 flex items-center sb-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <button
        onClick={() => setSemanticMode(!isSemanticMode)}
        className={cn(
          'flex items-center gap-1 px-2.5 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0',
          isSemanticMode
            ? 'bg-violet-600 text-white border border-violet-500/40'
            : 'sb-button sb-muted'
        )}
        title={t('search.semanticToggle')}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">AI</span>
      </button>
    </div>
  );
}
