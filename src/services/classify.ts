import Anthropic from '@anthropic-ai/sdk';
import { storageService } from './storage';
import { apiClient } from './apiClient';
import type { Bookmark, ApiProvider } from '../types';

export interface ClassifiedFolder {
  id: string;
  name: string;
  icon: string;
  bookmarkIds: string[];
}

export interface ClassificationResult {
  folders: ClassifiedFolder[];
}

interface BookmarkInfo {
  id: string;
  title: string;
  domain: string;
  summary: string;
  tags: string[];
}

class ClassifyService {
  private anthropicClient: Anthropic | null = null;
  private cachedAnthropicKey = '';

  private buildPrompt(bookmarks: BookmarkInfo[]): string {
    const bookmarkList = bookmarks
      .map(b => `[${b.id}] ${b.title} | ${b.domain} | ${b.summary || ''} | tags: ${b.tags.join(', ')}`)
      .join('\n');

    return `You are a bookmark organization expert. Analyze the following bookmarks and create meaningful folder categories to organize them.

## Requirements:

1. Create 5-15 folders based on the content (fewer if there are few bookmarks)
2. Each folder should have a clear, descriptive name (2-4 words)
3. Folder names should be in the same language as the majority of bookmark titles
4. Assign each bookmark to exactly one folder
5. Create an "Uncategorized" folder for bookmarks that don't fit elsewhere
6. Choose appropriate icons from: folder, briefcase, code, book-open, globe, shopping-cart, heart, star, music, video, image, file-text, tool, coffee, home, map, users, lightbulb, rocket, wrench, palette, database, server, cloud, lock, shield, zap, trending-up, bar-chart, gift, calendar, clock, mail, phone, camera, headphones, monitor, smartphone, tablet, watch, printer, wifi, bluetooth, battery, sun, moon, umbrella, thermometer

## Bookmarks to classify:

${bookmarkList}

## Output format:

Return ONLY a valid JSON object with this structure (no markdown, no explanation):
{
  "folders": [
    {
      "id": "unique_folder_id",
      "name": "Folder Name",
      "icon": "icon-name",
      "bookmarkIds": ["bookmark_id_1", "bookmark_id_2"]
    }
  ]
}`;
  }

  private parseJsonFromText(text: string): ClassificationResult {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('INVALID_JSON_RESPONSE');
    }

    const result = JSON.parse(jsonMatch[0]);
    if (!result.folders || !Array.isArray(result.folders)) {
      throw new Error('INVALID_RESPONSE_STRUCTURE');
    }

    return {
      folders: result.folders.map((f: ClassifiedFolder, index: number) => ({
        id: f.id || `folder_${index}`,
        name: f.name || 'Unnamed',
        icon: f.icon || 'folder',
        bookmarkIds: f.bookmarkIds || [],
      })),
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

  private async callAnthropic(bookmarks: BookmarkInfo[]): Promise<ClassificationResult> {
    const client = await this.getAnthropicClient();
    if (!client) {
      throw new Error('API_KEY_REQUIRED');
    }

    const settings = await storageService.getSettings();
    const prompt = this.buildPrompt(bookmarks);

    const response = await client.messages.create({
      model: settings.apiModel || 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
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
    bookmarks: BookmarkInfo[]
  ): Promise<ClassificationResult> {
    const settings = await storageService.getSettings();
    const apiKey = provider === 'openai'
      ? settings.apiKeys.openai
      : provider === 'gemini'
      ? settings.apiKeys.gemini
      : provider === 'grok'
      ? settings.apiKeys.grok
      : settings.apiKeys.custom;

    if (!apiKey) {
      throw new Error('API_KEY_REQUIRED');
    }

    let baseUrl = settings.apiBaseUrl?.trim();

    // Set default base URLs for known providers
    if (!baseUrl) {
      if (provider === 'openai') {
        baseUrl = 'https://api.openai.com/v1';
      } else if (provider === 'gemini') {
        baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
      } else if (provider === 'grok') {
        baseUrl = 'https://api.x.ai/v1';
      }
    }

    if (!baseUrl) {
      throw new Error('BASE_URL_REQUIRED');
    }

    // Validate API base URL protocol
    if (!/^https?:\/\//i.test(baseUrl)) {
      throw new Error('API base URL must use http:// or https://');
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const prompt = this.buildPrompt(bookmarks);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.apiModel,
        temperature: 0.3,
        max_tokens: 4096,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error?.message || error.error || 'API request failed');
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('INVALID_TEXT_RESPONSE');
    }

    return this.parseJsonFromText(text);
  }

  private async callProxy(bookmarks: BookmarkInfo[]): Promise<ClassificationResult> {
    const settings = await storageService.getSettings();

    if (!settings.userToken) {
      throw new Error('AUTH_TOKEN_REQUIRED');
    }

    const prompt = this.buildPrompt(bookmarks);

    const data = await apiClient.post<{
      success: boolean;
      data?: ClassificationResult;
      error?: string;
    }>('/classify', {
      prompt,
      model: settings.apiModel,
    });

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Invalid response');
    }

    return data.data;
  }

  private async callBatch(
    settings: { apiMode: string; apiProvider: ApiProvider },
    batch: BookmarkInfo[]
  ): Promise<ClassificationResult> {
    if (settings.apiMode === 'proxy') {
      return this.callProxy(batch);
    } else if (settings.apiProvider === 'anthropic') {
      return this.callAnthropic(batch);
    } else {
      return this.callOpenAICompatible(settings.apiProvider, batch);
    }
  }

  async classifyBookmarks(
    bookmarks: Bookmark[],
    onProgress?: (current: number, total: number) => void
  ): Promise<ClassificationResult> {
    const settings = await storageService.getSettings();

    // Prepare bookmark info for classification
    const bookmarkInfos: BookmarkInfo[] = bookmarks.map(b => ({
      id: b.id,
      title: b.title,
      domain: b.domain,
      summary: b.summary,
      tags: b.tags,
    }));

    onProgress?.(0, bookmarks.length);

    // Smaller batches for faster response + parallel execution
    const BATCH_SIZE = 30;
    const CONCURRENCY = 3;

    // Split into batches
    const batches: BookmarkInfo[][] = [];
    for (let i = 0; i < bookmarkInfos.length; i += BATCH_SIZE) {
      batches.push(bookmarkInfos.slice(i, i + BATCH_SIZE));
    }

    const allFolders: Map<string, ClassifiedFolder> = new Map();
    let processedCount = 0;
    let folderIdCounter = 0;

    const mergeBatchResult = (batchResult: ClassificationResult, batchSize: number) => {
      for (const folder of batchResult.folders) {
        const normalizedName = folder.name.toLowerCase().trim();
        const existing = allFolders.get(normalizedName);

        if (existing) {
          existing.bookmarkIds.push(...folder.bookmarkIds);
        } else {
          allFolders.set(normalizedName, {
            ...folder,
            id: `folder_${folderIdCounter++}`,
          });
        }
      }
      processedCount += batchSize;
      onProgress?.(processedCount, bookmarks.length);
    };

    // Process batches with concurrency limit
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const chunk = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map(batch => this.callBatch(settings, batch))
      );
      results.forEach((result, idx) => {
        mergeBatchResult(result, chunk[idx].length);
      });
    }

    return {
      folders: Array.from(allFolders.values()),
    };
  }
}

export const classifyService = new ClassifyService();
