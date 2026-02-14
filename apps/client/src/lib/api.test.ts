import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, authApi, fileApi } from '@/lib/api';

// We need to test fetchApi behavior through the exported API functions
// since fetchApi and getFileNameFromDisposition are not exported directly.

const mockFetch = vi.fn();

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ApiError', () => {
    it('has correct statusCode and message', () => {
      const error = new ApiError('Not Found', 404, 'NOT_FOUND', {
        detail: 'missing',
      });
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('Not Found');
      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe('NOT_FOUND');
      expect(error.details).toEqual({ detail: 'missing' });
    });

    it('works without optional fields', () => {
      const error = new ApiError('Server Error', 500);
      expect(error.statusCode).toBe(500);
      expect(error.errorCode).toBeUndefined();
      expect(error.details).toBeUndefined();
    });
  });

  describe('fetchApi (tested via authApi)', () => {
    it('adds Authorization header from localStorage token', async () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        'my-token',
      );
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Length': '2' }),
        text: () => Promise.resolve('{}'),
      });

      await authApi.me();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer my-token');
    });

    it('does not add Authorization header when no token', async () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Length': '2' }),
        text: () => Promise.resolve('{}'),
      });

      await authApi.me();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });

    it('prepends base URL from NEXT_PUBLIC_API_URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Length': '2' }),
        text: () => Promise.resolve('{}'),
      });

      await authApi.getSetupStatus();

      const [url] = mockFetch.mock.calls[0];
      // Default is http://localhost:4000/api/v1
      expect(url).toContain('/api/v1/auth/setup-status');
    });

    it('sends credentials: include', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Length': '2' }),
        text: () => Promise.resolve('{}'),
      });

      await authApi.me();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.credentials).toBe('include');
    });

    it('throws ApiError on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              message: 'Forbidden',
              errorCode: 'FORBIDDEN',
            }),
          ),
      });

      await expect(authApi.me()).rejects.toThrow(ApiError);

      try {
        await authApi.me();
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).statusCode).toBe(403);
        expect((e as ApiError).message).toBe('Forbidden');
        expect((e as ApiError).errorCode).toBe('FORBIDDEN');
      }
    });

    it('throws ApiError with fallback message when response is not JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      try {
        await authApi.me();
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).statusCode).toBe(500);
        // Non-JSON text becomes the message via { message: text }
        expect((e as ApiError).message).toBe('Internal Server Error');
      }
    });

    it('handles 204 No Content (returns empty object)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: () => Promise.resolve(''),
      });

      const result = await authApi.logout();
      expect(result).toEqual({});
    });

    it('handles Content-Length: 0 response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Length': '0' }),
        text: () => Promise.resolve(''),
      });

      const result = await authApi.logout();
      expect(result).toEqual({});
    });

    it('handles empty text response body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve(''),
      });

      const result = await authApi.me();
      expect(result).toEqual({});
    });
  });

  describe('authApi.login', () => {
    it('sends POST with correct body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Length': '50' }),
        text: () =>
          Promise.resolve(
            JSON.stringify({
              id: '1',
              name: 'Test',
              email: 'test@test.com',
              role: 'user',
              token: 'abc',
            }),
          ),
      });

      const result = await authApi.login({
        email: 'test@test.com',
        password: 'password123',
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/auth/login');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        email: 'test@test.com',
        password: 'password123',
      });
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(result.id).toBe('1');
      expect(result.token).toBe('abc');
    });
  });

  describe('getFileNameFromDisposition (tested via fileApi.download)', () => {
    it('parses filename from Content-Disposition header', async () => {
      const mockBlob = new Blob(['data']);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(mockBlob),
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="report.pdf"',
        }),
      });
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        'token',
      );

      const result = await fileApi.download('file-1');
      expect(result.fileName).toBe('report.pdf');
      expect(result.blob).toBe(mockBlob);
    });

    it('parses UTF-8 encoded filename from Content-Disposition', async () => {
      const mockBlob = new Blob(['data']);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(mockBlob),
        headers: new Headers({
          'Content-Disposition':
            "attachment; filename*=UTF-8''t%C3%A9st%20file.pdf",
        }),
      });
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        'token',
      );

      const result = await fileApi.download('file-2');
      expect(result.fileName).toBe('t\u00e9st file.pdf');
    });

    it('returns fallback name when Content-Disposition is missing', async () => {
      const mockBlob = new Blob(['data']);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(mockBlob),
        headers: new Headers(),
      });
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        'token',
      );

      const result = await fileApi.download('file-3');
      expect(result.fileName).toBe('download');
    });

    it('throws ApiError when download response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        'token',
      );

      await expect(fileApi.download('file-bad')).rejects.toThrow(ApiError);
    });
  });

  describe('fileApi.list', () => {
    it('builds query params correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: () =>
          Promise.resolve(
            JSON.stringify({
              items: [],
              meta: { total: 0, page: 1, limit: 20 },
            }),
          ),
      });

      await fileApi.list({
        page: 2,
        limit: 10,
        search: 'test',
        parentId: 'folder-1',
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('page=2');
      expect(url).toContain('limit=10');
      expect(url).toContain('search=test');
      expect(url).toContain('parentId=folder-1');
    });
  });
});
