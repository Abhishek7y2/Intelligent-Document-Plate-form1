import {
  EmbeddingService,
  SyntheticEmbeddingProvider,
  OpenAiCompatibleEmbeddingProvider,
  EmbeddingDimensionMismatchError,
  EmbeddingProviderError,
  MalformedVectorError,
  VECTOR_DIMENSIONS,
} from './embedding.service.js';

describe('EmbeddingService (ADR-002 Vector Specification)', () => {
  beforeEach(() => {
    EmbeddingService.setProvider(new SyntheticEmbeddingProvider());
  });

  describe('SyntheticEmbeddingProvider', () => {
    it('should generate an embedding vector with strictly 1536 dimensions', async () => {
      const vector = await EmbeddingService.generateEmbedding('Master Services Agreement and Liability Cap');
      expect(Array.isArray(vector)).toBe(true);
      expect(vector.length).toBe(VECTOR_DIMENSIONS);
      expect(vector.length).toBe(1536);
    });

    it('should generate deterministic embeddings for identical inputs', async () => {
      const text = 'Purchase invoice total amount INR 1,45,140.00 with 18% IGST';
      const vec1 = await EmbeddingService.generateEmbedding(text);
      const vec2 = await EmbeddingService.generateEmbedding(text);

      expect(vec1).toEqual(vec2);
    });

    it('should produce unit-normalized vectors (magnitude approx 1.0)', async () => {
      const vector = await EmbeddingService.generateEmbedding('Random contractual clause text');
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 4);
    });

    it('should produce higher cosine similarity for semantically related texts', async () => {
      const baseText = 'Total aggregate liability shall be capped at 100% of contract value.';
      const relatedText = 'Maximum liability and penalty limit under the supplier agreement.';
      const unrelatedText = 'Employee health insurance benefits and annual vacation schedule.';

      const vecBase = await EmbeddingService.generateEmbedding(baseText);
      const vecRelated = await EmbeddingService.generateEmbedding(relatedText);
      const vecUnrelated = await EmbeddingService.generateEmbedding(unrelatedText);

      const simRelated = EmbeddingService.cosineSimilarity(vecBase, vecRelated);
      const simUnrelated = EmbeddingService.cosineSimilarity(vecBase, vecUnrelated);

      expect(simRelated).toBeGreaterThan(simUnrelated);
    });

    it('should return 1.0 for cosine similarity of identical vectors', async () => {
      const vec = await EmbeddingService.generateEmbedding('Sample contract terms');
      const sim = EmbeddingService.cosineSimilarity(vec, vec);
      expect(sim).toBeCloseTo(1.0, 5);
    });
  });

  describe('Dimension Validation & Error Handling', () => {
    it('should throw EmbeddingDimensionMismatchError when vector length is not 1536', () => {
      const invalidVector = [0.1, 0.2, 0.3]; // length 3 instead of 1536
      expect(() => EmbeddingService.validateDimensions(invalidVector)).toThrow(
        EmbeddingDimensionMismatchError
      );
    });

    it('should throw when cosineSimilarity is called with vectors of incorrect length', () => {
      const valid = new Array(1536).fill(0.1);
      const invalid = [0.1, 0.2];

      expect(() => EmbeddingService.cosineSimilarity(valid, invalid)).toThrow(
        EmbeddingDimensionMismatchError
      );
    });

    it('should throw MalformedVectorError when vector contains NaN or Infinity', () => {
      const nanVector = new Array(1536).fill(0.1);
      nanVector[42] = NaN;

      expect(() => EmbeddingService.validateDimensions(nanVector)).toThrow(
        MalformedVectorError
      );

      const infVector = new Array(1536).fill(0.1);
      infVector[99] = Infinity;

      expect(() => EmbeddingService.validateDimensions(infVector)).toThrow(
        MalformedVectorError
      );
    });
  });

  describe('OpenAiCompatibleEmbeddingProvider', () => {
    it('should throw EmbeddingProviderError if API key is not configured', async () => {
      const provider = new OpenAiCompatibleEmbeddingProvider('');
      await expect(provider.generateEmbedding('Test text')).rejects.toThrow(
        EmbeddingProviderError
      );
    });

    it('should handle remote API errors safely', async () => {
      const provider = new OpenAiCompatibleEmbeddingProvider('mock-key', 'https://mock.invalid/endpoint');
      await expect(provider.generateEmbedding('Test text')).rejects.toThrow(
        EmbeddingProviderError
      );
    });
  });
});
