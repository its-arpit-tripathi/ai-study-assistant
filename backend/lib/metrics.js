/**
 * Production Provider Failure & Quota Usage Monitoring
 * Tracks LLM provider performance, failure rates, latency (TTFT), token usage, and client disconnects.
 */

class MetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = Date.now();
    this.requests = {
      total: 0,
      streaming: 0,
      standard: 0,
    };
    this.provider = {
      totalCalls: 0,
      successes: 0,
      failures: 0,
      retries: 0,
      fallbacks: 0,
      failuresByType: {
        rate_limit_429: 0,
        timeout: 0,
        server_5xx: 0,
        network_error: 0,
        other: 0,
      },
    };
    this.tokens = {
      estimatedPromptTokens: 0,
      estimatedCompletionTokens: 0,
      estimatedTotalTokens: 0,
    };
    this.streams = {
      active: 0,
      aborted: 0,
      completed: 0,
    };
    this.latencies = {
      ttftMs: [],
      totalStreamMs: [],
      verificationMs: [],
    };
  }

  recordRequest({ stream = false } = {}) {
    this.requests.total++;
    if (stream) {
      this.requests.streaming++;
    } else {
      this.requests.standard++;
    }
  }

  recordStreamStart() {
    this.streams.active++;
  }

  recordStreamEnd() {
    if (this.streams.active > 0) this.streams.active--;
    this.streams.completed++;
  }

  recordStreamAbort() {
    if (this.streams.active > 0) this.streams.active--;
    this.streams.aborted++;
  }

  recordProviderCall() {
    this.provider.totalCalls++;
  }

  recordProviderSuccess({
    promptTokens = 0,
    completionTokens = 0,
    ttftMs = null,
    totalMs = null,
  } = {}) {
    this.provider.successes++;
    this.tokens.estimatedPromptTokens += promptTokens;
    this.tokens.estimatedCompletionTokens += completionTokens;
    this.tokens.estimatedTotalTokens += promptTokens + completionTokens;

    if (ttftMs != null) {
      this._pushSample(this.latencies.ttftMs, ttftMs);
    }
    if (totalMs != null) {
      this._pushSample(this.latencies.totalStreamMs, totalMs);
    }
  }

  recordProviderFailure({ error, isRetry = false, isFallback = false } = {}) {
    this.provider.failures++;
    if (isRetry) this.provider.retries++;
    if (isFallback) this.provider.fallbacks++;

    const msg = String(error?.message || error || '').toLowerCase();
    const status = error?.status || error?.statusCode;

    if (status === 429 || msg.includes('429') || msg.includes('rate limit')) {
      this.provider.failuresByType.rate_limit_429++;
    } else if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('abort')) {
      this.provider.failuresByType.timeout++;
    } else if (status >= 500 || msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      this.provider.failuresByType.server_5xx++;
    } else if (msg.includes('econnreset') || msg.includes('fetch failed') || msg.includes('etimedout')) {
      this.provider.failuresByType.network_error++;
    } else {
      this.provider.failuresByType.other++;
    }

    // High failure rate alarm trigger
    const failureRate = this.getFailureRate();
    if (this.provider.totalCalls > 10 && failureRate > 0.25) {
      console.warn(`⚠️ [METRICS ALERT] High LLM provider failure rate: ${(failureRate * 100).toFixed(1)}% (${this.provider.failures}/${this.provider.totalCalls} failed)`);
    }
  }

  recordVerification({ durationMs = null, status = 'verified' } = {}) {
    if (durationMs != null) {
      this._pushSample(this.latencies.verificationMs, durationMs);
    }
  }

  _pushSample(arr, val) {
    arr.push(val);
    if (arr.length > 200) arr.shift();
  }

  _calcStats(arr) {
    if (!arr || arr.length === 0) return { avg: 0, p95: 0, count: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const avg = Math.round(sum / sorted.length);
    const p95Idx = Math.floor(sorted.length * 0.95);
    const p95 = Math.round(sorted[p95Idx] || sorted[sorted.length - 1]);
    return { avg, p95, count: arr.length };
  }

  getFailureRate() {
    if (this.provider.totalCalls === 0) return 0;
    return Number((this.provider.failures / this.provider.totalCalls).toFixed(4));
  }

  getSnapshot() {
    const uptimeSec = Math.round((Date.now() - this.startTime) / 1000);
    return {
      status: this.getFailureRate() > 0.3 ? 'degraded' : 'healthy',
      uptimeSeconds: uptimeSec,
      requests: { ...this.requests },
      streams: { ...this.streams },
      provider: {
        ...this.provider,
        failureRate: this.getFailureRate(),
      },
      tokens: { ...this.tokens },
      latencies: {
        timeToFirstTokenMs: this._calcStats(this.latencies.ttftMs),
        totalStreamMs: this._calcStats(this.latencies.totalStreamMs),
        verificationMs: this._calcStats(this.latencies.verificationMs),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const metrics = new MetricsCollector();
