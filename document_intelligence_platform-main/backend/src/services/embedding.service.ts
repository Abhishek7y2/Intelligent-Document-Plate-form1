import crypto from 'crypto';

export const VECTOR_DIMENSIONS = 1536;

export interface IEmbeddingProvider {
  name: string;
  dimensions: number;
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

export class EmbeddingDimensionMismatchError extends Error {
  statusCode = 500;
  code = 'EMBEDDING_DIMENSION_MISMATCH';
  constructor(expected: number, actual: number) {
    super(`Embedding dimension mismatch: expected ${expected} dimensions but received ${actual}.`);
    this.name = 'EmbeddingDimensionMismatchError';
  }
}

export class EmbeddingProviderError extends Error {
  statusCode = 502;
  code = 'EMBEDDING_PROVIDER_ERROR';
  constructor(message: string) {
    super(`Embedding provider error: ${message}`);
    this.name = 'EmbeddingProviderError';
  }
}

export class MalformedVectorError extends Error {
  statusCode = 400;
  code = 'MALFORMED_VECTOR';
  constructor(message: string) {
    super(message);
    this.name = 'MalformedVectorError';
  }
}

/**
 * Deterministic, unit-normalized 1536-dimensional embedding generator.
 * Used for isolated testing, offline environments, and CI/CD without API keys.
 */
export class SyntheticEmbeddingProvider implements IEmbeddingProvider {
  name = 'synthetic-1536-v1';
  dimensions = VECTOR_DIMENSIONS;

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      // Return zero-vector or uniform normalized vector
      return new Array(this.dimensions).fill(0);
    }

    const vector = new Array(this.dimensions).fill(0);
    const cleaned = text.toLowerCase().trim();
    const words = cleaned.split(/\s+/);

    // Compute base hash seed
    const hash = crypto.createHash('sha256').update(cleaned).digest();

    for (let i = 0; i < this.dimensions; i++) {
      const byteVal = hash[i % hash.length]!;
      const wordWeight = words[(i % words.length)] ? words[(i % words.length)]!.length : 1;
      const angle = (i * 0.17 + byteVal * 0.05 + wordWeight * 0.1) % (2 * Math.PI);
      vector[i] = Math.sin(angle);
    }

    // Add semantic features: if text contains known keywords, bias certain dimensions
    const semanticKeywords = [
      'invoice', 'contract', 'agreement', 'liability', 'payment', 'tax', 
      'penalty', 'termination', 'indemnity', 'confidential', 'approved', 'total'
    ];

    semanticKeywords.forEach((kw, kwIdx) => {
      if (cleaned.includes(kw)) {
        const offset = (kwIdx * 128) % this.dimensions;
        for (let j = 0; j < 32; j++) {
          const idx = (offset + j) % this.dimensions;
          vector[idx] += 1.5;
        }
      }
    });

    // L2 normalize
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] = vector[i] / norm;
      }
    }

    return vector;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }
}

/**
 * Live OpenAI-compatible provider adapter for production deployment.
 */
export class OpenAiCompatibleEmbeddingProvider implements IEmbeddingProvider {
  name = 'openai-text-embedding-3-small';
  dimensions = VECTOR_DIMENSIONS;
  private apiKey: string;
  private endpoint: string;

  constructor(apiKey?: string, endpoint = 'https://api.openai.com/v1/embeddings') {
    this.apiKey = apiKey || process.env['OPENAI_API_KEY'] || '';
    this.endpoint = endpoint;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new EmbeddingProviderError('Missing OpenAI API key. Cannot contact remote provider.');
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
          dimensions: this.dimensions,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new EmbeddingProviderError(`Provider responded with status ${response.status}: ${errText}`);
      }

      const json = (await response.json()) as any;
      const embedding = json?.data?.[0]?.embedding;
      if (!Array.isArray(embedding)) {
        throw new EmbeddingProviderError('Malformed provider response: missing embedding array.');
      }

      if (embedding.length !== this.dimensions) {
        throw new EmbeddingDimensionMismatchError(this.dimensions, embedding.length);
      }

      return embedding;
    } catch (err: any) {
      if (err instanceof EmbeddingDimensionMismatchError || err instanceof EmbeddingProviderError) {
        throw err;
      }
      throw new EmbeddingProviderError(err.message || 'Unknown network error');
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }
}

export class EmbeddingService {
  private static provider: IEmbeddingProvider = new SyntheticEmbeddingProvider();

  static setProvider(provider: IEmbeddingProvider): void {
    this.provider = provider;
  }

  static getProvider(): IEmbeddingProvider {
    return this.provider;
  }

  static async generateEmbedding(text: string): Promise<number[]> {
    const vector = await this.provider.generateEmbedding(text);
    this.validateDimensions(vector);
    return vector;
  }

  static validateDimensions(vector: number[]): void {
    if (!Array.isArray(vector) || vector.length !== VECTOR_DIMENSIONS) {
      throw new EmbeddingDimensionMismatchError(VECTOR_DIMENSIONS, vector?.length || 0);
    }
    for (let i = 0; i < vector.length; i++) {
      const val = vector[i];
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new MalformedVectorError(`Vector contains non-finite or invalid element at index ${i}: ${val}`);
      }
    }
  }

  /**
   * Computes cosine similarity between two unit-normalized vectors: range [-1.0, 1.0].
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    this.validateDimensions(vecA);
    this.validateDimensions(vecB);

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
      const a = vecA[i]!;
      const b = vecB[i]!;
      dot += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
