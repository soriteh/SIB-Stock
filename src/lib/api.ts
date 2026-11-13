export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('API paths must be relative to the application origin.')
  }

  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  let body: BodyInit | undefined
  if (options.body !== undefined) {
    if (options.body instanceof FormData || options.body instanceof URLSearchParams) {
      body = options.body
    } else if (
      typeof options.body === 'string' ||
      options.body instanceof Blob ||
      options.body instanceof ArrayBuffer
    ) {
      body = options.body
    } else {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body,
    credentials: 'include',
    cache: 'no-store',
  })

  if (response.status === 204) return undefined as T

  const contentType = response.headers.get('content-type') ?? ''
  const payload: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '')

  if (!response.ok) {
    const data = payload && typeof payload === 'object'
      ? payload as { message?: unknown; error?: unknown; code?: unknown }
      : undefined
    const message = typeof data?.message === 'string'
      ? data.message
      : typeof data?.error === 'string'
        ? data.error
        : `API request failed with status ${response.status}`
    const code = typeof data?.code === 'string' ? data.code : undefined
    throw new ApiError(message, response.status, code)
  }

  return payload as T
}

export const api = {
  get: <T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  put: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}
