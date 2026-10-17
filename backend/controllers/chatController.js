import { DocumentModel } from '../models/DocumentModel.js';
import { retrieveContext } from '../lib/vectorStore.js';
import { generateAnswer, streamAnswer, getGroqModel } from '../lib/llm.js';
import {
  answerCache,
  answerCacheKey,
  distributedRateLimiter,
  llmSemaphore,
} from '../lib/productionControls.js';
import { metrics } from '../lib/metrics.js';
import { evaluateGuardrails } from '../lib/guardrails.js';
import { chatHistory } from '../lib/chatHistory.js';

export const chatController = {
  async handleChat(req, res, next) {
    const isStream = Boolean(
      req.body?.stream || req.headers.accept?.includes('text/event-stream')
    );

    metrics.recordRequest({ stream: isStream });

    try {
      const { query, collectionName } = req.body || {};

      if (
        typeof query !== 'string' ||
        query.trim().length === 0 ||
        query.length > 4000 ||
        typeof collectionName !== 'string'
      ) {
        return res.status(400).json({ error: "Both 'query' and 'collectionName' are required." });
      }

      // Check query safety guardrails (Sexual content, Hate speech, Harassment, Violence, Dangerous content, Prompt injection)
      const guardrailResult = evaluateGuardrails(query);
      if (!guardrailResult.allowed) {
        const refusal = guardrailResult.refusalMessage || 'This request was blocked by content safety guardrails.';
        const primary = guardrailResult.primaryViolation;

        if (isStream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          res.flushHeaders?.();
          res.write(
            `event: error\ndata: ${JSON.stringify({
              error: refusal,
              code: 400,
              safetyBlocked: true,
              category: primary?.category || 'PROHIBITED_CONTENT',
              violations: guardrailResult.violations,
            })}\n\n`
          );
          return res.end();
        }

        return res.status(400).json({
          error: refusal,
          safetyBlocked: true,
          category: primary?.category || 'PROHIBITED_CONTENT',
          violations: guardrailResult.violations,
        });
      }

      // Check coordinated multi-replica rate limit
      const rateCheck = await distributedRateLimiter.checkLimit(req.user.id, {
        limit: Number(process.env.RATE_LIMIT_PER_USER_PER_MIN || 40),
        windowSec: 60,
      });

      if (!rateCheck.allowed) {
        res.setHeader('Retry-After', String(rateCheck.retryAfterSec));
        if (isStream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.flushHeaders?.();
          res.write(
            `event: error\ndata: ${JSON.stringify({
              error: 'Rate limit exceeded. Please wait a moment before sending another message.',
              code: 429,
              retryAfter: rateCheck.retryAfterSec,
            })}\n\n`
          );
          return res.end();
        }
        return res.status(429).json({
          error: 'Rate limit exceeded. Please wait a moment before sending another message.',
          retryAfter: rateCheck.retryAfterSec,
        });
      }

      const doc = await DocumentModel.findByCollection(req.user.id, collectionName);
      if (!doc) {
        return res.status(403).json({ error: 'Unauthorized access to this document.' });
      }

      // Retrieve recent conversation history from Redis for conversational context
      const priorTurns = await chatHistory.getRecentTurns(req.user.id, doc.id, 6);

      // Persist the incoming user query in Redis & PostgreSQL
      const userMsgId = req.body?.messageId || `u-${Date.now()}`;
      await chatHistory.saveMessage(req.user.id, doc.id, {
        id: userMsgId,
        role: 'user',
        content: query,
        timestamp: new Date().toISOString(),
      });

      // Check shared multi-replica answer cache
      const cacheKey = answerCacheKey({
        userId: req.user.id,
        documentId: doc.id,
        documentVersion: doc.version,
        query,
        model: getGroqModel(),
        promptVersion: process.env.PROMPT_VERSION || 'v1',
      });

      const cached = await answerCache.get(cacheKey);
      if (cached) {
        if (isStream) {
          metrics.recordStreamStart();
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          res.flushHeaders?.();

          const safeWrite = (event, data) => {
            if (res.writable && !res.writableEnded) {
              try {
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
              } catch {}
            }
          };

          let clientAborted = false;
          req.on('close', () => {
            clientAborted = true;
            metrics.recordStreamAbort();
          });

          safeWrite('sources', { sources: cached.sources, model: cached.model });

          // Stream cached tokens quickly for fluid UX
          const words = cached.answer.split(' ');
          for (let i = 0; i < words.length; i++) {
            if (clientAborted || !res.writable) break;
            const word = words[i] + (i < words.length - 1 ? ' ' : '');
            safeWrite('token', { token: word });
            await new Promise((r) => setTimeout(r, 10));
          }

          if (!clientAborted) {
            safeWrite('draft', {
              answer: cached.answer,
              status: 'draft',
              verified: false,
              model: cached.model,
            });
            safeWrite('verification', { verification: cached.verification });
            safeWrite('done', {
              done: true,
              answer: cached.answer,
              sources: cached.sources,
              verification: cached.verification,
              model: cached.model,
              cached: true,
            });
            // Persist cached response turn to Redis persistent chat
            await chatHistory.saveMessage(req.user.id, doc.id, {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: cached.answer,
              sources: cached.sources,
              verification: cached.verification,
              model: cached.model,
              timestamp: new Date().toISOString(),
            });

            metrics.recordStreamEnd();
            if (res.writable && !res.writableEnded) res.end();
          }
          return;
        }

        await chatHistory.saveMessage(req.user.id, doc.id, {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: cached.answer,
          sources: cached.sources,
          verification: cached.verification,
          model: cached.model,
          timestamp: new Date().toISOString(),
        });
        return res.json({ ...cached, cached: true });
      }

      // Hybrid retrieval & cross-encoder reranking
      const retrievalK = Math.max(1, Number(process.env.RETRIEVAL_K || 7));
      const contextChunks = await retrieveContext(query, collectionName, retrievalK, {
        userId: req.user.id,
        documentId: doc.id,
      });

      if (!contextChunks || contextChunks.length === 0) {
        const noInfoPayload = {
          answer: "I couldn't find any relevant information in the document for your question.",
          sources: [],
          verification: {
            status: 'unverified',
            summary: 'No relevant evidence was retrieved.',
            counts: { supported: 0, uncertain: 0, unsupported: 0 },
            claims: [],
          },
          model: getGroqModel(),
        };

        await chatHistory.saveMessage(req.user.id, doc.id, {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: noInfoPayload.answer,
          sources: noInfoPayload.sources,
          verification: noInfoPayload.verification,
          model: noInfoPayload.model,
          timestamp: new Date().toISOString(),
        });

        if (isStream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          res.flushHeaders?.();

          if (res.writable && !res.writableEnded) {
            try {
              res.write(`event: sources\ndata: ${JSON.stringify({ sources: [], model: getGroqModel() })}\n\n`);
              res.write(`event: token\ndata: ${JSON.stringify({ token: noInfoPayload.answer })}\n\n`);
              res.write(`event: draft\ndata: ${JSON.stringify({ answer: noInfoPayload.answer, status: 'draft' })}\n\n`);
              res.write(`event: verification\ndata: ${JSON.stringify({ verification: noInfoPayload.verification })}\n\n`);
              res.write(`event: done\ndata: ${JSON.stringify({ done: true, ...noInfoPayload })}\n\n`);
              res.end();
            } catch {}
          }
          return;
        }

        return res.json(noInfoPayload);
      }

      // Extract preliminary candidate sources
      const preliminarySources = [
        ...new Map(
          contextChunks.map((chunk, idx) => {
            const meta = chunk.metadata || {};
            const source = meta.source || doc.name || 'Document';
            const page = meta.pageNumber ?? meta.page ?? meta.loc?.pageNumber ?? null;
            const chunkId = meta.chunkId || null;
            const key = `${source}|${page ?? 'N/A'}`;
            return [
              key,
              {
                source,
                page: page != null && Number.isFinite(Number(page)) ? Number(page) : null,
                chunkId,
                label: `Chunk ${idx + 1}`,
              },
            ];
          })
        ).values(),
      ];

      if (isStream) {
        metrics.recordStreamStart();
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        let clientAborted = false;
        const abortController = new AbortController();

        // Listen for client disconnection / request cancellation
        req.on('close', () => {
          clientAborted = true;
          abortController.abort();
          metrics.recordStreamAbort();
        });

        const sendEvent = (event, data) => {
          if (!clientAborted && res.writable && !res.writableEnded) {
            try {
              res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            } catch {
              clientAborted = true;
              abortController.abort();
            }
          }
        };

        // Keep-alive heartbeat to prevent intermediate proxies, firewalls, and browsers from timing out
        const keepAliveInterval = setInterval(() => {
          if (!clientAborted && res.writable && !res.writableEnded) {
            try {
              res.write(': keep-alive\n\n');
            } catch {}
          }
        }, 2500);

        try {
          // 1. Initial Sources Event
          sendEvent('sources', { sources: preliminarySources, model: getGroqModel() });

          const result = await llmSemaphore.run(
            async () => {
              return streamAnswer(
                query,
                contextChunks,
                (token) => {
                  if (!clientAborted) {
                    sendEvent('token', { token });
                  }
                },
                abortController.signal,
                {
                  conversationHistory: priorTurns,
                  // 2. Draft Answer Communication Event
                  onDraft: (draft) => {
                    if (!clientAborted) {
                      sendEvent('draft', {
                        answer: draft.answer,
                        status: 'draft',
                        verified: false,
                        model: draft.model,
                      });
                    }
                  },
                  // 3. Verification Progress Event
                  onVerificationProgress: (progress) => {
                    if (!clientAborted) {
                      sendEvent('verification_progress', progress);
                    }
                  },
                }
              );
            },
            { signal: abortController.signal }
          );

          if (clientAborted) {
            return;
          }

          // 4. Final Citation-Verification Event
          sendEvent('verification', { verification: result.verification });

          // 5. Completion Event
          sendEvent('done', {
            done: true,
            model: result.model,
            answer: result.answer,
            sources: result.sources,
            verification: result.verification,
          });

          // Persist completed assistant response to Redis persistent chat
          await chatHistory.saveMessage(req.user.id, doc.id, {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: result.answer,
            sources: result.sources,
            verification: result.verification,
            model: result.model,
            timestamp: new Date().toISOString(),
          });

          metrics.recordStreamEnd();

          // Cache completed result across replicas
          await answerCache.set(cacheKey, result).catch(() => {});
        } catch (streamError) {
          if (!clientAborted && res.writable && !res.writableEnded) {
            sendEvent('error', {
              error: streamError.message || 'Stream generation encountered an error.',
              status: streamError.status || 500,
            });
          }
        } finally {
          clearInterval(keepAliveInterval);
          if (res.writable && !res.writableEnded) {
            try {
              res.end();
            } catch {}
          }
        }
        return;
      }

      // Non-streaming fallback
      const { answer, sources, model, verification } = await llmSemaphore.run(() =>
        generateAnswer(query, contextChunks, { conversationHistory: priorTurns })
      );

      const payload = { answer, sources, model, verification };
      await answerCache.set(cacheKey, payload);

      // Persist assistant response to Redis persistent chat
      await chatHistory.saveMessage(req.user.id, doc.id, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: payload.answer,
        sources: payload.sources,
        verification: payload.verification,
        model: payload.model,
        timestamp: new Date().toISOString(),
      });

      return res.json(payload);
    } catch (error) {
      if (res.headersSent) {
        if (res.writable && !res.writableEnded) {
          try {
            res.write(
              `event: error\ndata: ${JSON.stringify({
                error: error.message || 'Streaming failed',
                code: error.status || 500,
              })}\n\n`
            );
            res.end();
          } catch {}
        }
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/chat/history/:documentId
   * Retrieve persistent chat history for a document from Redis / PostgreSQL
   */
  async getHistory(req, res, next) {
    try {
      const { documentId } = req.params;
      if (!documentId) {
        return res.status(400).json({ error: 'Document ID is required.' });
      }

      const doc = await DocumentModel.findById(req.user.id, documentId);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found or access denied.' });
      }

      const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
      const messages = await chatHistory.getHistory(req.user.id, doc.id, limit);

      return res.json({
        documentId: doc.id,
        documentName: doc.name,
        messages,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/chat/history/:documentId
   * Clear persistent chat history for a document in Redis & PostgreSQL
   */
  async clearHistory(req, res, next) {
    try {
      const { documentId } = req.params;
      if (!documentId) {
        return res.status(400).json({ error: 'Document ID is required.' });
      }

      const doc = await DocumentModel.findById(req.user.id, documentId);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found or access denied.' });
      }

      await chatHistory.clearHistory(req.user.id, doc.id);

      return res.json({
        success: true,
        message: 'Persistent chat history cleared successfully.',
        documentId: doc.id,
      });
    } catch (error) {
      next(error);
    }
  },
};
