import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';

let unifiedClient = null;
let activeProvider = null; // 'upstash' | 'ioredis' | null
let isConnected = false;
let hasLoggedFailure = false;

export function getRedisClient() {
  if (unifiedClient) return unifiedClient;

  // 1. Prioritize Upstash Redis REST if credentials are provided
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const upstash = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      unifiedClient = {
        provider: 'upstash',
        rpush: (key, ...values) => upstash.rpush(key, ...values),
        lrange: (key, start, stop) => upstash.lrange(key, start, stop),
        ltrim: (key, start, stop) => upstash.ltrim(key, start, stop),
        del: (...keys) => upstash.del(...keys),
        expire: (key, seconds) => upstash.expire(key, seconds),
        ping: () => upstash.ping(),
        raw: upstash,
      };

      activeProvider = 'upstash';
      isConnected = true;
      console.log(`✅ [Redis] Connected to Upstash Redis REST (${process.env.UPSTASH_REDIS_REST_URL})`);
      return unifiedClient;
    } catch (err) {
      console.warn(`⚠️ [Redis] Upstash initialization failed: ${err.message}`);
    }
  }

  // 2. Fall back to standard TCP Redis (ioredis) via REDIS_URL
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  try {
    const ioClient = new IORedis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 400, 2000);
      },
    });

    ioClient.on('connect', () => {
      isConnected = true;
      hasLoggedFailure = false;
    });

    ioClient.on('ready', () => {
      isConnected = true;
      console.log(`✅ [Redis] Connected to TCP Redis at ${redisUrl.replace(/:[^:@]+@/, ':***@')}`);
    });

    ioClient.on('error', (err) => {
      isConnected = false;
      if (!hasLoggedFailure && activeProvider !== 'upstash') {
        hasLoggedFailure = true;
        console.warn(`⚠️ [Redis] Connection unavailable (${err.code || err.message}). Fallback persistence active.`);
      }
    });

    ioClient.on('close', () => {
      isConnected = false;
    });

    ioClient.connect().catch(() => {
      isConnected = false;
    });

    unifiedClient = {
      provider: 'ioredis',
      rpush: (key, ...values) => ioClient.rpush(key, ...values),
      lrange: (key, start, stop) => ioClient.lrange(key, start, stop),
      ltrim: (key, start, stop) => ioClient.ltrim(key, start, stop),
      del: (...keys) => ioClient.del(...keys),
      expire: (key, seconds) => ioClient.expire(key, seconds),
      ping: () => ioClient.ping(),
      raw: ioClient,
    };

    activeProvider = 'ioredis';
    return unifiedClient;
  } catch (err) {
    console.warn(`⚠️ [Redis] Failed to initialize TCP Redis: ${err.message}`);
    unifiedClient = null;
    activeProvider = null;
    isConnected = false;
    return null;
  }
}

export function isRedisAvailable() {
  if (activeProvider === 'upstash') return true;
  return Boolean(unifiedClient && isConnected && unifiedClient.raw?.status === 'ready');
}

export function getRedisProvider() {
  return activeProvider;
}

export async function pingRedis() {
  const client = getRedisClient();
  if (!client) {
    return { ok: false, status: 'uninitialized', error: 'Redis client not initialized' };
  }

  try {
    const pong = await client.ping();
    const isOk = pong === 'PONG';
    return {
      ok: isOk,
      status: isOk ? 'ready' : 'degraded',
      provider: activeProvider,
      url: activeProvider === 'upstash'
        ? process.env.UPSTASH_REDIS_REST_URL
        : (process.env.REDIS_URL || 'redis://127.0.0.1:6379').replace(/:[^:@]+@/, ':***@'),
    };
  } catch (error) {
    return {
      ok: false,
      status: 'disconnected',
      provider: activeProvider,
      error: error.message,
    };
  }
}

export async function closeRedis() {
  if (unifiedClient) {
    if (activeProvider === 'ioredis' && unifiedClient.raw) {
      try {
        await unifiedClient.raw.quit().catch(() => unifiedClient.raw.disconnect());
      } catch {}
    }
    unifiedClient = null;
    activeProvider = null;
    isConnected = false;
  }
}
