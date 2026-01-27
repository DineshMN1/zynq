import { FileMetadata } from './file';

export enum SharePermission {
  READ = 'read',
  WRITE = 'write',
}

export interface Share {
  id: string;
  file_id: string;
  grantee_user_id?: string;
  grantee_email?: string;
  permission: SharePermission;
  created_by: string;
  created_at: string;
  file?: FileMetadata;
  is_public?: boolean;
  share_token?: string | null;
  publicLink?: string | null;
  expires_at?: string | null;
}

export interface ShareFileDto {
  toUserId?: string;
  email?: string;
  permission: SharePermission;
  isPublic?: boolean;
}
