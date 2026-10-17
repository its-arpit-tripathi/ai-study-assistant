import Redis from 'ioredis';

let redisClient = null;
let isConnected = false;
let hasLoggedFailure = false;

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export function getRedisClient() {
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 5) {
          return null; // Stop endless loop if redis is down
        }
        return Math.min(times * 400, 2000);
      },
    });

    redisClient.on('connect', () => {
      isConnected = true;
      hasLoggedFailure = false;
    });

    redisClient.on('ready', () => {
      isConnected = true;
      console.log(`✅ [Redis] Connected and ready at ${redisUrl.replace(/:[^:@]+@/, ':***@')}`);
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      if (!hasLoggedFailure) {
        hasLoggedFailure = true;
        console.warn(`⚠️ [Redis] Connection unavailable (${err.code || err.message}). Fallback persistence active.`);
      }
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    // Attempt non-blocking initial connection
    redisClient.connect().catch(() => {
      isConnected = false;
    });
  } catch (err) {
    console.warn(`⚠️ [Redis] Failed to initialize client: ${err.message}`);
    redisClient = null;
    isConnected = false;
  }

  return redisClient;
}

export function isRedisAvailable() {
  return Boolean(redisClient && isConnected && redisClient.status === 'ready');
}

export async function pingRedis() {
  const client = getRedisClient();
  if (!client) {
    return { ok: false, status: 'uninitialized', error: 'Redis client not initialized' };
  }

  try {
    if (client.status !== 'ready' && client.status !== 'connecting') {
      await client.connect().catch(() => {});
    }
    const pong = await client.ping();
    return {
      ok: pong === 'PONG',
      status: pong === 'PONG' ? 'ready' : client.status,
      url: redisUrl.replace(/:[^:@]+@/, ':***@'),
    };
  } catch (error) {
    return {
      ok: false,
      status: client.status || 'disconnected',
      error: error.message,
      url: redisUrl.replace(/:[^:@]+@/, ':***@'),
    };
  }
}

export async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit().catch(() => redisClient.disconnect());
    } catch {}
    redisClient = null;
    isConnected = false;
  }
}
