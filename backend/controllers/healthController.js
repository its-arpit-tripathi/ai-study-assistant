import { pingQdrant } from '../lib/vectorStore.js';
import { getGroqModel } from '../lib/llm.js';
import { embeddingInfo } from '../lib/embeddings.js';
import { llmSemaphore, answerCache } from '../lib/productionControls.js';
import { metrics } from '../lib/metrics.js';

export const healthController = {
  async getHealth(req, res) {
    const qdrant = await pingQdrant();
    const metricsSnapshot = metrics.getSnapshot();

    res.status(qdrant.ok && metricsSnapshot.status !== 'degraded' ? 200 : (qdrant.ok ? 200 : 503)).json({
      status: qdrant.ok ? (metricsSnapshot.status === 'degraded' ? 'degraded' : 'ok') : 'error',
      qdrant,
      llm: {
        provider: 'groq',
        model: getGroqModel(),
        configured: Boolean(process.env.GROQ_API_KEY),
        failureRate: metricsSnapshot.provider.failureRate,
      },
      embeddings: embeddingInfo(),
      runtime: {
        llmConcurrency: llmSemaphore.snapshot(),
        answerCacheEntries: answerCache.size,
        activeStreams: metricsSnapshot.streams.active,
      },
      timestamp: new Date().toISOString(),
    });
  },

  async getMetrics(req, res) {
    const snapshot = metrics.getSnapshot();
    return res.json(snapshot);
  },
};
