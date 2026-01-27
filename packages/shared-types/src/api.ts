export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface ApiSuccessResponse {
  success: boolean;
}

export interface DownloadResponse {
  url: string;
}
