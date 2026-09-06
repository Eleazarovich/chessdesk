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
const AUTH_STORAGE_KEY = 'chessops_auth';
export const SESSION_EXPIRED_EVENT = 'chessdesk:session-expired';
let accessToken: string | null = null;
let sessionExpiryHandled = false;

function handleUnauthorized(path: string): void {
  accessToken = null;
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_STORAGE_KEY);

  // Login failures are expected to be rendered by the login form. Only
  // protected requests should end the current application session.
  if (path.startsWith('/auth/')) return;
  if (sessionExpiryHandled || window.location.pathname === '/sign-up-login-screen') return;

  sessionExpiryHandled = true;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

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
    if (response.status === 401) handleUnauthorized(path);
    throw new ApiError(response.status, (payload ?? null) as ApiErrorPayload | null);
  }

  return payload as T;
}

export const apiClient = {
  setAccessToken(token: string): void {
    accessToken = token;
    sessionExpiryHandled = false;
    if (typeof window !== 'undefined') sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  },

  clearAccessToken(): void {
    accessToken = null;
    if (typeof window !== 'undefined') sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  },

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return request<T>(path, {}, params);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  },

  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  },

  delete<T = void>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
};
