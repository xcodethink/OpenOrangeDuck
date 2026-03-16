import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Loader2, RotateCcw } from 'lucide-react';

interface TranslatableTextProps {
  text: string;
  bookmarkId: string;
  field: 'summary' | 'content';
  cachedTranslation?: string;       // Pre-cached translation from bookmark.translations
  className?: string;
  maxLength?: number;
  expandable?: boolean;
}

// Simple language detection based on character ranges
function detectLanguage(text: string): string {
  const sample = text.substring(0, 500);
  const totalLetters = sample.replace(/[\s\d\p{P}\p{S}]/gu, '');
  if (totalLetters.length === 0) return 'en';

  const cjk = (sample.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const viet = (sample.match(/[ạảãàáâầẩẫấậăằẳẵắặẹẻẽèéêềểễếệịỉĩìíọỏõòóôồổỗốộơờởỡớợụủũùúưừửữứựỳỷỹỵý]/gi) || []).length;

  const ratio = totalLetters.length;
  if (cjk / ratio > 0.3) return 'zh';
  if (viet / ratio > 0.05) return 'vi';
  return 'en';
}

// Map i18n language to full name for AI prompt
const languageNames: Record<string, string> = {
  zh: '中文',
  en: 'English',
  vi: 'Tiếng Việt',
};

export default function TranslatableText({
  text,
  bookmarkId,
  field,
  cachedTranslation,
  className = '',
  maxLength,
  expandable = false,
}: TranslatableTextProps) {
  const { t, i18n } = useTranslation();
  const userLang = i18n.language.split('-')[0]; // 'zh-CN' → 'zh'
  const contentLang = detectLanguage(text);
  const needsTranslation = contentLang !== userLang;

  const [showTranslated, setShowTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState(cachedTranslation || '');
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Update if cached translation becomes available
  useEffect(() => {
    if (cachedTranslation) setTranslatedText(cachedTranslation);
  }, [cachedTranslation]);

  const handleTranslate = async () => {
    if (translatedText) {
      setShowTranslated(true);
      return;
    }

    setTranslating(true);
    setError('');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_CONTENT',
        bookmarkId,
        text: text.substring(0, 4000), // Limit for AI token efficiency
        targetLanguage: userLang,
        field,
      });

      if (response?.success && response.translatedText) {
        setTranslatedText(response.translatedText);
        setShowTranslated(true);
      } else {
        setError(response?.error || t('translate.error'));
      }
    } catch (err) {
      console.error('Translation failed:', err);
      setError(t('translate.error'));
    } finally {
      setTranslating(false);
    }
  };

  const displayText = showTranslated && translatedText ? translatedText : text;
  const truncated = maxLength && displayText.length > maxLength && !expanded;
  const shownText = truncated ? displayText.substring(0, maxLength) + '...' : displayText;

  return (
    <div>
      <div className={className}>
        {shownText}
      </div>

      {/* Expandable toggle */}
      {expandable && maxLength && displayText.length > maxLength && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-violet-500 hover:text-violet-400 mt-1 flex items-center gap-1"
        >
          {expanded ? t('detail.showLess') : t('detail.showMore')}
        </button>
      )}

      {/* Translation controls */}
      {needsTranslation && (
        <div className="flex items-center gap-2 mt-2">
          {!showTranslated ? (
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="flex items-center gap-1.5 text-xs text-violet-500 hover:text-violet-400 transition-colors disabled:opacity-50"
            >
              {translating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Languages className="w-3.5 h-3.5" />
              )}
              {translating
                ? t('translate.translating')
                : t('translate.translateTo', { lang: languageNames[userLang] || userLang })}
            </button>
          ) : (
            <button
              onClick={() => setShowTranslated(false)}
              className="flex items-center gap-1.5 text-xs text-violet-500 hover:text-violet-400 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('translate.showOriginal')}
            </button>
          )}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      )}
    </div>
  );
}
