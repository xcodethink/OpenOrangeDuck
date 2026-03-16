import type { ApiProvider } from '../types';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ModelFetchResult {
  success: boolean;
  models: ModelInfo[];
  error?: string;
}

// Anthropic doesn't have a public models API, so we use static list
const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku', description: 'fast' },
  { id: 'claude-sonnet-4-6-20250610', name: 'Claude Sonnet 4.6', description: 'latest' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'balanced' },
];

// Filter patterns for chat/completion models (exclude embedding, tts, whisper, etc.)
const CHAT_MODEL_PATTERNS = [
  /^gpt-/i,
  /^o1/i,
  /^o3/i,
  /^chatgpt/i,
  /^grok/i,
  /^gemini/i,
  /models\/gemini/i,
];

const EXCLUDE_PATTERNS = [
  /embed/i,
  /tts/i,
  /whisper/i,
  /dall-e/i,
  /davinci/i,
  /babbage/i,
  /curie/i,
  /ada(?!-)/i,  // ada but not ada-xxx
  /moderation/i,
  /realtime/i,
  /audio/i,
  /-vision-preview$/i,
  /search/i,
  /instruct(?!-)/i,
  /text-embedding/i,
  /aqa$/i,  // Gemini AQA models
];

function isChatModel(modelId: string): boolean {
  // Check if matches any chat pattern
  const matchesChat = CHAT_MODEL_PATTERNS.some(p => p.test(modelId));
  // Check if matches any exclude pattern
  const matchesExclude = EXCLUDE_PATTERNS.some(p => p.test(modelId));
  return matchesChat && !matchesExclude;
}

function formatModelName(modelId: string): string {
  // Extract model name from full path (e.g., "models/gemini-2.0-flash" -> "Gemini 2.0 Flash")
  const name = modelId.replace(/^models\//, '');

  // Capitalize and format
  return name
    .split('-')
    .map(part => {
      // Keep version numbers as-is
      if (/^\d/.test(part)) return part;
      // Capitalize first letter
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ')
    .replace(/\.(\d)/g, '.$1'); // Keep version dots
}

export const modelService = {
  /**
   * Fetch available models from the provider's API
   */
  async fetchModels(
    provider: ApiProvider,
    apiKey: string,
    baseUrl?: string
  ): Promise<ModelFetchResult> {
    try {
      // Anthropic doesn't have a models API
      if (provider === 'anthropic') {
        return { success: true, models: ANTHROPIC_MODELS };
      }

      let url: string;
      let headers: Record<string, string>;

      if (provider === 'gemini') {
        // Gemini uses different API structure
        url = 'https://generativelanguage.googleapis.com/v1beta/models';
        headers = {
          'x-goog-api-key': apiKey,
        };
      } else {
        // OpenAI-compatible APIs (OpenAI, Grok, Custom)
        let base = baseUrl?.trim();
        if (!base) {
          if (provider === 'openai') {
            base = 'https://api.openai.com/v1';
          } else if (provider === 'grok') {
            base = 'https://api.x.ai/v1';
          } else {
            return { success: false, models: [], error: 'BASE_URL_REQUIRED' };
          }
        }
        // Validate API base URL protocol
        if (!/^https?:\/\//i.test(base)) {
          return { success: false, models: [], error: 'API base URL must use http:// or https://' };
        }
        url = `${base.replace(/\/+$/, '')}/models`;
        headers = {
          'Authorization': `Bearer ${apiKey}`,
        };
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          models: [],
          error: error.error?.message || `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      let models: ModelInfo[] = [];

      if (provider === 'gemini') {
        // Gemini response format: { models: [{ name: "models/gemini-2.0-flash", ... }] }
        models = (data.models || [])
          .filter((m: { name: string }) => isChatModel(m.name))
          .map((m: { name: string; displayName?: string; description?: string }) => ({
            id: m.name.replace(/^models\//, ''),
            name: m.displayName || formatModelName(m.name),
            description: m.description?.slice(0, 50),
          }));
      } else {
        // OpenAI-compatible response format: { data: [{ id: "gpt-4o", ... }] }
        models = (data.data || [])
          .filter((m: { id: string }) => isChatModel(m.id))
          .map((m: { id: string; name?: string }) => ({
            id: m.id,
            name: m.name || formatModelName(m.id),
          }));
      }

      // Sort models: newer/better models first
      models.sort((a, b) => {
        // Priority keywords
        const priority = ['4o', 'o3', 'o1', 'grok-3', 'gemini-2', 'sonnet-4', 'latest'];
        const aScore = priority.findIndex(p => a.id.includes(p));
        const bScore = priority.findIndex(p => b.id.includes(p));
        if (aScore !== -1 && bScore === -1) return -1;
        if (bScore !== -1 && aScore === -1) return 1;
        if (aScore !== bScore) return aScore - bScore;
        return a.id.localeCompare(b.id);
      });

      return { success: true, models };
    } catch (error) {
      return {
        success: false,
        models: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Verify API key by attempting to fetch models
   */
  async verifyApiKey(
    provider: ApiProvider,
    apiKey: string,
    baseUrl?: string
  ): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey) {
      return { valid: false, error: 'API_KEY_REQUIRED' };
    }

    const result = await this.fetchModels(provider, apiKey, baseUrl);
    return {
      valid: result.success,
      error: result.error,
    };
  },
};
