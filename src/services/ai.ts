import Anthropic from '@anthropic-ai/sdk';
import { storageService } from './storage';
import { apiClient } from './apiClient';
import type { ApiProvider } from '../types';

export interface SummaryResult {
  summary: string;
  tags: string[];
  category: string;
}

export interface AIService {
  generateSummary(content: string, title: string): Promise<SummaryResult>;
  translateText(text: string, targetLanguage: string): Promise<string>;
  isConfigured(): Promise<boolean>;
}

// Proxy service response format
interface ProxyResponse {
  success: boolean;
  data?: SummaryResult;
  error?: string;
}

class AIProviderService implements AIService {
  private anthropicClient: Anthropic | null = null;
  private cachedAnthropicKey = '';

  private buildPrompt(content: string, title: string): string {
    const truncatedContent = content.length > 4000
      ? content.substring(0, 4000) + '...'
      : content;

    return `You are a content analysis assistant. Analyze the following webpage and return a JSON object.

## Requirements:

### summary (string, required)
- Length: 100-200 characters (not words)
- Language: MUST match the content language (Chinese content → Chinese summary)
- Style: Concise, objective, highlight key information
- Format: Single paragraph, no bullet points

### tags (array, required)
- Count: 3-5 tags
- Format: lowercase, no special characters, 2-20 chars each
- Language: Match content language
- Types: core topics, content type (tutorial/docs/news), domain (frontend/ai), tech stack
- Example: ["react", "hooks", "frontend", "tutorial"]

### category (string, required)
- Format: Title case, general category
- Options: Technology, Programming, Design, Business, News, Education, Entertainment, Reference, Tools, Research, Shopping, Finance, Health, Travel, or "Uncategorized"

## Input:

Title: ${title}

Content:
${truncatedContent}

## Output:

Return ONLY a valid JSON object, no markdown, no explanation:
{"summary": "...", "tags": [...], "category": "..."}`;
  }

  private parseJsonFromText(text: string): SummaryResult {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('INVALID_JSON_RESPONSE');
    }

    const result = JSON.parse(jsonMatch[0]) as SummaryResult;
    if (!result.summary || !Array.isArray(result.tags)) {
      throw new Error('INVALID_RESPONSE_STRUCTURE');
    }

    return {
      summary: result.summary,
      tags: result.tags.slice(0, 5),
      category: result.category || 'Uncategorized',
    };
  }

  private async getAnthropicClient(): Promise<Anthropic | null> {
    const settings = await storageService.getSettings();
    const apiKey = settings.apiKeys.anthropic;

    if (settings.apiMode !== 'custom' || !apiKey) {
      this.anthropicClient = null;
      this.cachedAnthropicKey = '';
      return null;
    }

    if (!this.anthropicClient || this.cachedAnthropicKey !== apiKey) {
      this.anthropicClient = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
      });
      this.cachedAnthropicKey = apiKey;
    }

    return this.anthropicClient;
  }

  async isConfigured(): Promise<boolean> {
    const settings = await storageService.getSettings();

    if (settings.apiMode === 'proxy') {
      return Boolean(settings.userToken);
    }

    const provider = settings.apiProvider;
    if (provider === 'anthropic') return Boolean(settings.apiKeys.anthropic);
    if (provider === 'openai') return Boolean(settings.apiKeys.openai);
    if (provider === 'gemini') return Boolean(settings.apiKeys.gemini);
    if (provider === 'grok') return Boolean(settings.apiKeys.grok);
    // Custom provider requires both API key and base URL
    return Boolean(settings.apiKeys.custom && settings.apiBaseUrl);
  }

  private async callProxy(content: string, title: string): Promise<SummaryResult> {
    const settings = await storageService.getSettings();

    if (!settings.userToken) {
      throw new Error('AUTH_TOKEN_REQUIRED');
    }

    const prompt = this.buildPrompt(content, title);

    const data = await apiClient.post<ProxyResponse>('/summarize', {
      prompt,
      model: settings.apiModel,
    });

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Invalid response');
    }

    return data.data;
  }

  private async callAnthropic(content: string, title: string): Promise<SummaryResult> {
    const client = await this.getAnthropicClient();
    if (!client) {
      throw new Error('API_KEY_REQUIRED');
    }

    const settings = await storageService.getSettings();
    const prompt = this.buildPrompt(content, title);

    const response = await client.messages.create({
      model: settings.apiModel || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('INVALID_TEXT_RESPONSE');
    }

    return this.parseJsonFromText(textContent.text);
  }

  private async callOpenAICompatible(
    provider: ApiProvider,
    content: string,
    title: string
  ): Promise<SummaryResult> {
    const settings = await storageService.getSettings();

    // Get API key based on provider
    let apiKey: string | undefined;
    if (provider === 'openai') {
      apiKey = settings.apiKeys.openai;
    } else if (provider === 'gemini') {
      apiKey = settings.apiKeys.gemini;
    } else if (provider === 'grok') {
      apiKey = settings.apiKeys.grok;
    } else {
      apiKey = settings.apiKeys.custom;
    }

    if (!apiKey) {
      throw new Error('API_KEY_REQUIRED');
    }

    // Get base URL - use default for known providers if not specified
    const baseUrl = settings.apiBaseUrl?.trim();
    let defaultBase = '';
    if (provider === 'openai') {
      defaultBase = 'https://api.openai.com/v1';
    } else if (provider === 'gemini') {
      defaultBase = 'https://generativelanguage.googleapis.com/v1beta/openai';
    } else if (provider === 'grok') {
      defaultBase = 'https://api.x.ai/v1';
    }
    const resolvedBase = baseUrl || defaultBase;

    if (!resolvedBase) {
      throw new Error('BASE_URL_REQUIRED');
    }

    // Validate API base URL protocol
    if (!/^https?:\/\//i.test(resolvedBase)) {
      throw new Error('API base URL must use http:// or https://');
    }

    const url = `${resolvedBase.replace(/\/+$/, '')}/chat/completions`;
    const prompt = this.buildPrompt(content, title);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.apiModel,
        temperature: 0.2,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'API request failed');
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('INVALID_TEXT_RESPONSE');
    }

    return this.parseJsonFromText(text);
  }

  private buildTranslatePrompt(text: string, targetLanguage: string): string {
    const langNames: Record<string, string> = { zh: '中文', en: 'English', vi: 'Tiếng Việt' };
    const langName = langNames[targetLanguage] || targetLanguage;
    const truncated = text.length > 4000 ? text.substring(0, 4000) + '...' : text;

    return `Translate the following text into ${langName}. Output ONLY the translation, no explanations, no prefixes like "Translation:", no markdown.

Text:
${truncated}`;
  }

  private async callTranslateAnthropic(text: string, targetLanguage: string): Promise<string> {
    const client = await this.getAnthropicClient();
    if (!client) throw new Error('API_KEY_REQUIRED');

    const settings = await storageService.getSettings();
    const response = await client.messages.create({
      model: settings.apiModel || 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: this.buildTranslatePrompt(text, targetLanguage) }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') throw new Error('INVALID_TEXT_RESPONSE');
    return textContent.text.trim();
  }

  private async callTranslateOpenAICompatible(provider: ApiProvider, text: string, targetLanguage: string): Promise<string> {
    const settings = await storageService.getSettings();
    let apiKey: string | undefined;
    if (provider === 'openai') apiKey = settings.apiKeys.openai;
    else if (provider === 'gemini') apiKey = settings.apiKeys.gemini;
    else if (provider === 'grok') apiKey = settings.apiKeys.grok;
    else apiKey = settings.apiKeys.custom;

    if (!apiKey) throw new Error('API_KEY_REQUIRED');

    const baseUrl = settings.apiBaseUrl?.trim();
    let defaultBase = '';
    if (provider === 'openai') defaultBase = 'https://api.openai.com/v1';
    else if (provider === 'gemini') defaultBase = 'https://generativelanguage.googleapis.com/v1beta/openai';
    else if (provider === 'grok') defaultBase = 'https://api.x.ai/v1';
    const resolvedBase = baseUrl || defaultBase;
    if (!resolvedBase) throw new Error('BASE_URL_REQUIRED');

    const url = `${resolvedBase.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.apiModel,
        temperature: 0.2,
        messages: [{ role: 'user', content: this.buildTranslatePrompt(text, targetLanguage) }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'API request failed');
    }

    const data = await response.json();
    const result = data?.choices?.[0]?.message?.content;
    if (!result) throw new Error('INVALID_TEXT_RESPONSE');
    return result.trim();
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    const settings = await storageService.getSettings();

    if (settings.apiMode === 'proxy') {
      const prompt = this.buildTranslatePrompt(text, targetLanguage);
      const data = await apiClient.post<{ success: boolean; data?: string; error?: string }>('/translate', {
        prompt,
        model: settings.apiModel,
      });
      if (data.success && data.data) return data.data;
      throw new Error(data.error || 'Proxy translate failed');
    }

    if (settings.apiProvider === 'anthropic') {
      return await this.callTranslateAnthropic(text, targetLanguage);
    }

    return await this.callTranslateOpenAICompatible(settings.apiProvider, text, targetLanguage);
  }

  async generateSummary(content: string, title: string): Promise<SummaryResult> {
    const settings = await storageService.getSettings();

    try {
      if (settings.apiMode === 'proxy') {
        return await this.callProxy(content, title);
      }

      if (settings.apiProvider === 'anthropic') {
        return await this.callAnthropic(content, title);
      }

      return await this.callOpenAICompatible(settings.apiProvider, content, title);
    } catch (error) {
      console.error('AI API error:', error);

      if (error instanceof Error && (
        error.message === 'AUTH_TOKEN_REQUIRED' ||
        error.message === 'INSUFFICIENT_BALANCE' ||
        error.message === 'AUTH_EXPIRED' ||
        error.message === 'API_KEY_REQUIRED' ||
        error.message === 'BASE_URL_REQUIRED'
      )) {
        throw error;
      }

      return {
        summary: `${title} - Content saved for later reading.`,
        tags: ['uncategorized'],
        category: 'Uncategorized',
      };
    }
  }

  resetClient(): void {
    this.anthropicClient = null;
  }
}

export const aiService = new AIProviderService();
