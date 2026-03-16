import { apiClient } from './apiClient';

interface EmbeddingResult {
  success: boolean;
  id?: string;
  message?: string;
}

interface SearchResult {
  bookmarkId: string;
  score: number;
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
}

interface BatchResult {
  success: boolean;
  processed: number;
  skipped: number;
  failed: number;
}

export const embeddingService = {
  /**
   * Generate embedding for a single bookmark (fire-and-forget safe).
   */
  async generateEmbedding(bookmarkId: string, text: string): Promise<EmbeddingResult> {
    return apiClient.post<EmbeddingResult>('/embedding/generate', {
      bookmarkId,
      text,
    });
  },

  /**
   * Search for similar bookmarks by text query.
   * Returns bookmark IDs with similarity scores.
   */
  async searchSimilar(query: string, limit = 20): Promise<SearchResult[]> {
    const response = await apiClient.post<SearchResponse>('/embedding/search', {
      query,
      limit,
    });
    return response.results;
  },

  /**
   * Generate embeddings for multiple bookmarks in batch.
   */
  async generateBatch(bookmarks: Array<{ id: string; text: string }>): Promise<BatchResult> {
    return apiClient.post<BatchResult>('/embedding/batch', { bookmarks });
  },
};
