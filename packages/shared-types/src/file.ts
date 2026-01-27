export interface FileMetadata {
  id: string;
  owner_id: string;
  name: string;
  mime_type: string;
  size: number;
  storage_path?: string;
  parent_id?: string | null;
  is_folder: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFileDto {
  name: string;
  size: number;
  mimeType: string;
  parentId?: string;
  isFolder?: boolean;
}

export interface FileWithUploadUrl extends FileMetadata {
  uploadUrl?: string;
  presignedFields?: Record<string, string>;
}
