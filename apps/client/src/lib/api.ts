/**
 * API client for zynqCloud backend.
 * Handles authentication, file operations, sharing, and admin functions.
 * @module api
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/**
 * Custom error class for API errors with status code and details.
 */
export class ApiError extends Error {
  statusCode: number;
  errorCode?: string;
  details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'owner';
  storage_used?: number;
  storage_limit?: number;
  created_at?: string;
  token?: string;
}

export interface ShareableUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'owner';
}

export interface FileMetadata {
  id: string;
  owner_id: string;
  name: string;
  mime_type: string;
  size: number;
  storage_path?: string;
  parent_id?: string | null;
  is_folder: boolean;
  file_hash?: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  shareCount?: number;
  publicShareCount?: number;
  privateShareCount?: number;
}

export interface Share {
  id: string;
  file_id: string;
  grantee_user_id?: string;
  grantee_email?: string;
  grantee_user?: { id: string; name: string; email: string };
  permission: 'read' | 'write';
  created_by: string;
  created_at: string;
  file?: FileMetadata;
  is_public?: boolean;
  share_token?: string | null;
  publicLink?: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  token?: string;
  role: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  created_at: string;
  expires_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface StorageOverview {
  system: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercentage: number;
  };
  user: {
    usedBytes: number;
    quotaBytes: number;
    freeBytes: number;
    usedPercentage: number;
    isUnlimited: boolean;
  };
}

export interface UserStorageInfo {
  userId: string;
  name: string;
  email: string;
  role: string;
  usedBytes: number;
  quotaBytes: number;
  usedPercentage: number;
  isUnlimited: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringField(value: unknown, key: string): string | undefined {
  if (isRecord(value) && typeof value[key] === 'string') {
    return value[key] as string;
  }
  return undefined;
}

function getErrorMessage(value: unknown, fallback: string): string {
  return getStringField(value, 'message') ?? fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : fallback;
  return Number.isFinite(num) ? num : fallback;
}

function getFileNameFromDisposition(
  contentDisposition: string | null,
  fallback = 'download',
): string {
  if (!contentDisposition) return fallback;
  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return encodedMatch[1];
    }
  }
  const match = contentDisposition.match(/filename="?([^"]+)"?/);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return fallback;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    let errorData: unknown = {};

    try {
      errorData = JSON.parse(text) as unknown;
    } catch {
      errorData = { message: text };
    }

    throw new ApiError(
      getErrorMessage(errorData, 'An error occurred'),
      response.status,
      getStringField(errorData, 'errorCode'),
      errorData,
    );
  }

  if (
    response.status === 204 ||
    response.headers.get('Content-Length') === '0'
  ) {
    return {} as T;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

/** Authentication API: login, register, logout, password reset */
export const authApi = {
  getSetupStatus: () => fetchApi<{ needsSetup: boolean }>('/auth/setup-status'),

  register: (data: {
    name: string;
    email: string;
    password: string;
    inviteToken?: string;
  }) =>
    fetchApi<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    fetchApi<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    fetchApi<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  me: () => fetchApi<User>('/auth/me'),

  forgotPassword: (data: { email: string }) =>
    fetchApi<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  resetPassword: (data: { token: string; password: string }) =>
    fetchApi<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProfile: (data: { name: string }) =>
    fetchApi<User>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    fetchApi<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

/** File API: CRUD, upload, download, share, trash operations */
export const fileApi = {
  list: (params: {
    page?: number;
    limit?: number;
    search?: string;
    parentId?: string;
  }) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.search) query.append('search', params.search);
    if (params.parentId) query.append('parentId', params.parentId);
    return fetchApi<PaginatedResponse<FileMetadata>>(`/files?${query}`);
  },

  create: (data: {
    name: string;
    size: number;
    mimeType: string;
    parentId?: string;
    isFolder?: boolean;
    fileHash?: string;
    skipDuplicateCheck?: boolean;
  }) =>
    fetchApi<
      FileMetadata & {
        uploadUrl?: string;
        presignedFields?: Record<string, string>;
        duplicateFiles?: FileMetadata[];
      }
    >('/files', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  upload: async (fileId: string, file: File): Promise<FileMetadata> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/files/${fileId}/upload`, {
      method: 'PUT',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      let errorData: unknown = {};
      try {
        errorData = JSON.parse(text) as unknown;
      } catch {
        errorData = { message: text };
      }
      throw new ApiError(
        getErrorMessage(errorData, 'Upload failed'),
        response.status,
        getStringField(errorData, 'errorCode'),
        errorData,
      );
    }

    return response.json();
  },

  checkDuplicate: (fileHash: string, fileName?: string) =>
    fetchApi<{ isDuplicate: boolean; existingFile?: FileMetadata }>(
      '/files/check-duplicate',
      {
        method: 'POST',
        body: JSON.stringify({ fileHash, fileName }),
      },
    ),

  get: (id: string) => fetchApi<FileMetadata>(`/files/${id}`),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/files/${id}`, {
      method: 'DELETE',
    }),

  restore: (id: string) =>
    fetchApi<FileMetadata>(`/files/${id}/restore`, {
      method: 'POST',
    }),

  permanentDelete: (id: string) =>
    fetchApi<void>(`/files/${id}/permanent`, {
      method: 'DELETE',
    }),

  share: (
    id: string,
    data: {
      toUserId?: string;
      email?: string;
      permission: 'read' | 'write';
      isPublic?: boolean;
    },
  ) =>
    fetchApi<Share>(`/files/${id}/share`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getShared: () => fetchApi<Share[]>('/files/shared'),
  getPublicShares: () => fetchApi<Share[]>('/files/public-shares'),
  getPrivateShares: () => fetchApi<Share[]>('/files/private-shares'),
  revokeShare: (shareId: string) =>
    fetchApi<{ success: boolean }>(`/files/shares/${shareId}`, {
      method: 'DELETE',
    }),

  downloadShared: async (shareId: string) => {
    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/files/shares/${shareId}/download`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new ApiError('Download failed', response.status);
    }

    const blob = await response.blob();
    const fileName = getFileNameFromDisposition(
      response.headers.get('Content-Disposition'),
    );

    return { blob, fileName };
  },
  bulkDelete: (ids: string[]) =>
    fetchApi<{ deleted: number }>('/files/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    }),

  rename: (id: string, name: string) =>
    fetchApi<FileMetadata>(`/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  emptyTrash: () =>
    fetchApi<void>('/files/trash/empty', {
      method: 'DELETE',
    }),

  download: async (id: string) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/files/${id}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new ApiError('Download failed', response.status);
    }

    const blob = await response.blob();
    const fileName = getFileNameFromDisposition(
      response.headers.get('Content-Disposition'),
    );

    return { blob, fileName };
  },

  trash: (params: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    return fetchApi<PaginatedResponse<FileMetadata>>(`/files/trash?${query}`);
  },
};

/** Invitation API: create, list, revoke (admin), accept (public) */
export const inviteApi = {
  create: (data: { email: string; role: string }) =>
    fetchApi<
      Invitation & { link: string; email_sent: boolean; email_message?: string }
    >('/invites', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: () => fetchApi<Invitation[]>('/invites'),

  validate: (token: string) =>
    fetchApi<{
      valid: boolean;
      email: string;
      role: string;
      expires_at: string;
    }>(`/invites/validate/${encodeURIComponent(token)}`),

  revoke: (id: string) =>
    fetchApi<{ success: boolean }>(`/invites/${id}/revoke`, {
      method: 'POST',
    }),

  accept: (data: {
    token: string;
    name: string;
    email: string;
    password: string;
  }) =>
    fetchApi<User>('/invites/accept', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

/** Admin API: user management (admin/owner only) */
export const adminApi = {
  getUsers: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return fetchApi<PaginatedResponse<User>>(`/admin/users?${query}`);
  },

  listUsers: (params: { page?: number; limit?: number }) =>
    adminApi.getUsers(params),

  updateUser: (id: string, data: { role?: string; storage_limit?: number }) =>
    fetchApi<User>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    fetchApi<{ success: boolean }>(`/admin/users/${id}`, {
      method: 'DELETE',
    }),
};

/** Users API: shareable user list (auth required) */
export const userApi = {
  listShareable: (query?: string) => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    const suffix = params.toString() ? `?${params}` : '';
    return fetchApi<ShareableUser[]>(`/users/shareable${suffix}`);
  },
};

/** Settings API: user preferences */
export const settingsApi = {
  get: () => fetchApi<Record<string, unknown>>('/settings'),

  update: (data: { theme?: 'dark' | 'light'; telemetry?: boolean }) =>
    fetchApi<Record<string, unknown>>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

/** SMTP API: email configuration (admin only) */
export const smtpApi = {
  getSettings: () =>
    fetchApi<{
      smtp_host: string;
      smtp_port: number;
      smtp_secure: boolean;
      smtp_user: string;
      smtp_pass: string;
      smtp_from: string;
      has_password: boolean;
    }>('/settings/smtp'),

  updateSettings: (data: {
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    smtp_user?: string;
    smtp_pass?: string;
    smtp_from: string;
  }) =>
    fetchApi<Record<string, unknown>>('/settings/smtp', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  testConnection: (data?: { email?: string }) =>
    fetchApi<{ success: boolean; message: string }>('/settings/smtp/test', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
};

/** Storage API: quota and usage information */
export const storageApi = {
  getOverview: () => fetchApi<StorageOverview>('/storage/overview'),

  getUserStorage: (userId: string) =>
    fetchApi<UserStorageInfo & { actualUsedBytes: number; freeBytes: number }>(
      `/storage/users/${userId}`,
    ),

  getAllUsersStorage: () => fetchApi<UserStorageInfo[]>('/storage/users'),

  updateUserQuota: (userId: string, quotaBytes: number) =>
    fetchApi<{
      userId: string;
      name: string;
      quotaBytes: number;
      usedBytes: number;
    }>(`/storage/users/${userId}/quota`, {
      method: 'PATCH',
      body: JSON.stringify({ storage_quota: quotaBytes }),
    }),
};

/** Public API: anonymous access to shared files */
export const publicApi = {
  getShare: async (token: string) => {
    const data = await fetchApi<{
      id: string;
      name: string;
      size: number;
      mimeType: string;
      owner: string;
      ownerId: string;
      createdAt: string;
      isFolder: boolean;
      hasContent: boolean;
    }>(`/public/share/${token}`);
    return {
      ...data,
      size: toNumber(data.size, 0),
    };
  },

  downloadShare: async (token: string) => {
    const response = await fetch(
      `${API_BASE_URL}/public/share/${token}/download`,
    );

    if (!response.ok) {
      throw new ApiError('Download failed', response.status);
    }

    const blob = await response.blob();
    const fileName = getFileNameFromDisposition(
      response.headers.get('Content-Disposition'),
    );

    return { blob, fileName };
  },
};
