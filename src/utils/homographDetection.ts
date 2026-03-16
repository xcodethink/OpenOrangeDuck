import type { HomographResult } from '../types/threatTypes';

// Cyrillic → Latin confusable map
const CONFUSABLES: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p',
  '\u0441': 'c', '\u0443': 'y', '\u0445': 'x', '\u0456': 'i',
  '\u0458': 'j', '\u04BB': 'h', '\u0501': 'd', '\u051B': 'q',
  // Greek → Latin
  '\u03B1': 'a', '\u03B5': 'e', '\u03BF': 'o', '\u03C1': 'p',
  '\u03B9': 'i', '\u03BA': 'k', '\u03BD': 'v', '\u03C5': 'u',
  '\u03C9': 'w', '\u03C4': 't', '\u03B7': 'n',
  // Common substitutions (number-for-letter)
  '0': 'o', '1': 'l',
};

function getScript(code: number): string | null {
  if (code >= 0x0041 && code <= 0x007A) return 'Latin';
  if (code >= 0x0400 && code <= 0x04FF) return 'Cyrillic';
  if (code >= 0x0500 && code <= 0x052F) return 'Cyrillic';
  if (code >= 0x0370 && code <= 0x03FF) return 'Greek';
  if (code >= 0x0030 && code <= 0x0039) return null; // digits are script-neutral
  if (code === 0x002D || code === 0x002E) return null; // hyphen, dot
  return 'Other';
}

export function detectHomographAttack(domain: string): HomographResult {
  const isPunycode = domain.startsWith('xn--') || domain.includes('.xn--');

  // Check for mixed scripts in each label
  const labels = domain.split('.');
  let mixedScripts = false;

  for (const label of labels) {
    const scripts = new Set<string>();
    for (const char of label) {
      const code = char.codePointAt(0)!;
      const script = getScript(code);
      if (script) scripts.add(script);
    }
    if (scripts.size > 1) {
      mixedScripts = true;
      break;
    }
  }

  // Build a "normalized" version replacing confusable chars with Latin equivalents
  let normalized = '';
  let hasConfusable = false;
  for (const char of domain) {
    const replacement = CONFUSABLES[char];
    if (replacement) {
      normalized += replacement;
      hasConfusable = true;
    } else {
      normalized += char;
    }
  }

  return {
    isHomograph: mixedScripts || (isPunycode && hasConfusable),
    isPunycode,
    mixedScripts,
    confusableWith: hasConfusable && normalized !== domain ? normalized : undefined,
  };
}
