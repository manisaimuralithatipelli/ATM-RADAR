// Thin fetch wrapper. Errors carry the server's machine code so the UI can
// translate the message into the selected language.

export class ApiClientError extends Error {
  constructor(status, code, fields = null, extra = {}) {
    super(code);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryAfterSeconds = extra.retryAfterSeconds;
  }
}

function buildUrl(path, query) {
  const url = new URL(path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.pathname + url.search;
}

async function request(method, path, { query, body, signal } = {}) {
  const options = { method, signal, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(buildUrl(path, query), options);
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiClientError(0, 'NETWORK_ERROR');
  }

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch (err) {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload && payload.error) || {};
    throw new ApiClientError(
      response.status,
      error.code || 'INTERNAL_ERROR',
      error.fields || null,
      { retryAfterSeconds: error.retryAfterSeconds }
    );
  }

  return payload;
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body: body === undefined ? {} : body }),
};
