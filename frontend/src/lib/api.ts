export interface ApiErrorPayload {
  message?: string;
  code?: string;
  field_errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, payload: ApiErrorPayload | null) {
    super(payload?.message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.code;
    this.fieldErrors = payload?.field_errors;
  }
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const ACCESS_TOKEN_KEY = 'chessdesk_access_token';
const GET_CACHE_TTL_MS = 5_000;
let accessToken: string | null = null;
const getCache = new Map<string, { value: unknown; expiresAt: number }>();
const pendingGets = new Map<string, Promise<unknown>>();
let cacheVersion = 0;

function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window === 'undefined') return null;
  accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  return accessToken;
}

function requestUrl(path: string, params?: Record<string, string>): string {
  const query = params ? new URLSearchParams(params).toString() : '';
  return `${API_BASE_URL}/${path.replace(/^\//, '')}${query ? `?${query}` : ''}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function request<T>(path: string, init: RequestInit = {}, params?: Record<string, string>): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(requestUrl(path, params), {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(response.status, (payload ?? null) as ApiErrorPayload | null);
  }

  return payload as T;
}

function clearGetCache(): void {
  cacheVersion += 1;
  getCache.clear();
}

export const apiClient = {
  setAccessToken(token: string): void {
    accessToken = token;
    if (typeof window !== 'undefined') sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  },

  clearAccessToken(): void {
    accessToken = null;
    if (typeof window !== 'undefined') sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  },

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const key = requestUrl(path, params);
    const cached = getCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value as T);
    if (cached) getCache.delete(key);

    const pending = pendingGets.get(key);
    if (pending) return pending as Promise<T>;

    const requestVersion = cacheVersion;
    const requestPromise = request<T>(path, {}, params)
      .then(value => {
        if (requestVersion === cacheVersion) {
          getCache.set(key, { value, expiresAt: Date.now() + GET_CACHE_TTL_MS });
        }
        return value;
      })
      .finally(() => pendingGets.delete(key));
    pendingGets.set(key, requestPromise);
    return requestPromise;
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    clearGetCache();
    return request<T>(path, {
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  },

  patch<T>(path: string, body: unknown): Promise<T> {
    clearGetCache();
    return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  },

  delete<T = void>(path: string): Promise<T> {
    clearGetCache();
    return request<T>(path, { method: 'DELETE' });
  },
};
