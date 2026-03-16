// Text similarity utilities

// Tokenize text into words
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1);
}

// Calculate Jaccard similarity between two texts
export function jaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));

  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

// Calculate cosine similarity using word frequency vectors
export function cosineSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  // Build frequency maps
  const freq1 = new Map<string, number>();
  const freq2 = new Map<string, number>();

  tokens1.forEach(token => {
    freq1.set(token, (freq1.get(token) || 0) + 1);
  });

  tokens2.forEach(token => {
    freq2.set(token, (freq2.get(token) || 0) + 1);
  });

  // Get all unique words
  const allWords = new Set([...freq1.keys(), ...freq2.keys()]);

  // Calculate dot product and magnitudes
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  allWords.forEach(word => {
    const val1 = freq1.get(word) || 0;
    const val2 = freq2.get(word) || 0;
    dotProduct += val1 * val2;
    magnitude1 += val1 * val1;
    magnitude2 += val2 * val2;
  });

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) return 0;

  return dotProduct / (magnitude1 * magnitude2);
}

// Combined similarity score
export function calculateSimilarity(text1: string, text2: string): number {
  const jaccard = jaccardSimilarity(text1, text2);
  const cosine = cosineSimilarity(text1, text2);

  // Weighted average (cosine usually works better for longer texts)
  return jaccard * 0.3 + cosine * 0.7;
}

// Semantic expansion map for search
export const semanticMap: Record<string, string[]> = {
  // English
  'frontend framework': ['react', 'vue', 'angular', 'svelte', 'hooks', 'component', 'state'],
  'artificial intelligence': ['ai', 'gpt', 'llm', 'deep learning', 'neural', 'machine learning'],
  'machine learning': ['ai', 'gpt', 'deep learning', 'neural', 'ml', 'tensorflow', 'pytorch'],
  'css': ['style', 'tailwind', 'scss', 'sass', 'styled-components', 'responsive'],
  'backend': ['node', 'python', 'java', 'api', 'database', 'server', 'rest', 'graphql'],

  // Chinese
  '前端框架': ['react', 'vue', 'angular', '前端', 'hooks', '组件', '状态管理'],
  '人工智能': ['ai', 'gpt', 'llm', '深度学习', '神经网络', '机器学习'],
  '机器学习': ['ai', 'gpt', '深度学习', '神经网络', 'ml', '算法'],
  '样式': ['css', 'tailwind', 'scss', '响应式', '布局'],
  '后端': ['node', 'python', 'java', 'api', '数据库', '服务器'],
};

// Expand search query with semantic related terms
export function expandSearchTerms(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const terms = [lowerQuery];

  // Check semantic map
  for (const [key, values] of Object.entries(semanticMap)) {
    if (lowerQuery.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerQuery)) {
      terms.push(...values);
    }
  }

  return [...new Set(terms)];
}
