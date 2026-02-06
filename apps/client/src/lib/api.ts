/**
 * API client for zynqCloud backend.
 * Handles authentication, file operations, sharing, and admin functions.
 * @module api
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/**
 * Custom error class for API errors with status code and details.
 */
export class ApiError extends Error {
  statusCode: number;
  errorCode?: string;
  details?: any;

  constructor(message: string, statusCode: number, errorCode?: string, details?: any) {
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
}

export interface Share {
  id: string;
  file_id: string;
  grantee_user_id?: string;
  grantee_email?: string;
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

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    let errorData: any = {};

    try {
      errorData = JSON.parse(text);
    } catch {
      errorData = { message: text };
    }

    throw new ApiError(
      errorData.message || 'An error occurred',
      response.status,
      errorData.errorCode,
      errorData
    );
  }

  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    return {} as T;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

/** Authentication API: login, register, logout, password reset */
export const authApi = {
  getSetupStatus: () => fetchApi<{ needsSetup: boolean }>('/auth/setup-status'),

  register: (data: { name: string; email: string; password: string; inviteToken?: string }) =>
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

  checkSetupStatus: () => fetchApi<{ needsSetup: boolean }>('/auth/setup-status'),

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
};

/** File API: CRUD, upload, download, share, trash operations */
export const fileApi = {
  list: (params: { page?: number; limit?: number; search?: string; parentId?: string }) => {
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
    fetchApi<FileMetadata & {
      uploadUrl?: string;
      presignedFields?: Record<string, string>;
      duplicateFiles?: FileMetadata[];
    }>(
      '/files',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

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
      let errorData: any = {};
      try {
        errorData = JSON.parse(text);
      } catch {
        errorData = { message: text };
      }
      throw new ApiError(
        errorData.message || 'Upload failed',
        response.status,
        errorData.errorCode,
        errorData
      );
    }

    return response.json();
  },

  checkDuplicate: (fileHash: string) =>
    fetchApi<{ isDuplicate: boolean; existingFile?: FileMetadata }>(
      '/files/check-duplicate',
      {
        method: 'POST',
        body: JSON.stringify({ fileHash }),
      }
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

  share: (id: string, data: {
    toUserId?: string;
    email?: string;
    permission: 'read' | 'write';
    isPublic?: boolean;
  }) =>
    fetchApi<Share>(`/files/${id}/share`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getShared: () => fetchApi<Share[]>('/files/shared'),
  getPublicShares: () => fetchApi<Share[]>('/files/public-shares'),
  revokeShare: (shareId: string) =>
    fetchApi<{ success: boolean }>(`/files/shares/${shareId}`, {
      method: 'DELETE',
    }),
  bulkDelete: (ids: string[]) =>
    fetchApi<{ deleted: number }>('/files/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
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
    const contentDisposition = response.headers.get('Content-Disposition');
    let fileName = 'download';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) {
        fileName = decodeURIComponent(match[1]);
      }
    }

    return { blob, fileName };
  },

  trash: (params: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.page) query.append("page", params.page.toString());
    if (params.limit) query.append("limit", params.limit.toString());
    return fetchApi<PaginatedResponse<FileMetadata>>(`/files/trash?${query}`);
  },
};

/** Invitation API: create, list, revoke invitations (admin only) */
export const inviteApi = {
  create: (data: { email: string; role: string }) =>
    fetchApi<Invitation & { link: string }>('/invites', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: () => fetchApi<Invitation[]>('/invites'),

  revoke: (id: string) =>
    fetchApi<{ success: boolean }>(`/invites/${id}/revoke`, {
      method: 'POST',
    }),

  accept: (data: { token: string; name: string; email: string; password: string }) =>
    fetchApi<User>('/invites/accept', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

/** Admin API: user management (admin/owner only) */
export const adminApi = {
  listUsers: (params: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    return fetchApi<PaginatedResponse<User>>(`/admin/users?${query}`);
  },

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

  testConnection: () =>
    fetchApi<{ success: boolean; message: string }>('/settings/smtp/test', {
      method: 'POST',
    }),
};

/** Storage API: quota and usage information */
export const storageApi = {
  getOverview: () => fetchApi<StorageOverview>('/storage/overview'),

  getUserStorage: (userId: string) =>
    fetchApi<UserStorageInfo & { actualUsedBytes: number; freeBytes: number }>(
      `/storage/users/${userId}`
    ),

  getAllUsersStorage: () => fetchApi<UserStorageInfo[]>('/storage/users'),

  updateUserQuota: (userId: string, quotaBytes: number) =>
    fetchApi<{ userId: string; name: string; quotaBytes: number; usedBytes: number }>(
      `/storage/users/${userId}/quota`,
      {
        method: 'PATCH',
        body: JSON.stringify({ storage_quota: quotaBytes }),
      }
    ),
};

/** Public API: anonymous access to shared files */
export const publicApi = {
  getShare: (token: string) =>
    fetchApi<{
      id: string;
      name: string;
      size: number;
      mimeType: string;
      owner: string;
      ownerId: string;
      createdAt: string;
      isFolder: boolean;
      hasContent: boolean;
    }>(`/public/share/${token}`),

  downloadShare: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/public/share/${token}/download`);

    if (!response.ok) {
      throw new ApiError('Download failed', response.status);
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    let fileName = 'download';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) {
        fileName = decodeURIComponent(match[1]);
      }
    }

    return { blob, fileName };
  },
};
