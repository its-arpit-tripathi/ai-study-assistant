// API Client for NotebookLM RAG

const TOKEN_KEY = 'notebookToken';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = { error: text || `HTTP error ${response.status}` };
  }

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  async register(email, password) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch('/api/auth/me', {
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  async getHealth() {
    const res = await fetch('/api/health');
    return handleResponse(res);
  },

  async getDocuments() {
    const res = await fetch('/api/documents', {
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  async warmDocument(id) {
    if (!id) return;
    try {
      await fetch(`/api/documents/${encodeURIComponent(id)}/warm`, {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch {
      // Fire-and-forget pre-warm
    }
  },

  async deleteDocument(id) {
    const res = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  async uploadDocument(file) {
    const formData = new FormData();
    formData.append('document', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    return handleResponse(res);
  },

  async sendChat(query, collectionName, options = {}) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ query, collectionName }),
      signal: options?.signal,
    });
    return handleResponse(res);
  },

  async sendChatStream(query, collectionName, { onToken, onSources, onDraft, onVerification, onDone, signal } = {}) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...authHeaders(),
      },
      body: JSON.stringify({ query, collectionName, stream: true }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed with status ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Response body is not readable.');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    // Watchdog timer: detect dead connections after 25s of inactivity
    const INACTIVITY_TIMEOUT_MS = 25000;
    let timeoutId = null;

    const resetWatchdog = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          reader.cancel();
        } catch {}
      }, INACTIVITY_TIMEOUT_MS);
    };

    resetWatchdog();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        resetWatchdog();
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.trim()) continue;
          // Ignore SSE comments/pings (e.g. ": keep-alive")
          if (part.startsWith(':')) continue;

          const lines = part.split('\n');
          let eventType = 'message';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith(':')) continue;
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataStr = line.slice(5).trim();
            }
          }

          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              if (eventType === 'token') {
                onToken?.(data.token);
              } else if (eventType === 'sources') {
                onSources?.(data.sources, data.model);
              } else if (eventType === 'draft') {
                onDraft?.(data);
              } else if (eventType === 'verification') {
                onVerification?.(data.verification);
              } else if (eventType === 'done') {
                onDone?.(data);
              } else if (eventType === 'error') {
                throw new Error(data.error || 'Stream error occurred.');
              }
            } catch (err) {
              if (eventType === 'error') throw err;
            }
          }
        }
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  },

  async getPdfBlob(documentId) {
    const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/file`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Could not load PDF evidence.');
    }
    return res.blob();
  },
};
