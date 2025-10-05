import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator'; // ✅ Added IsBoolean
import { SharePermission } from '../entities/share.entity';

export class ShareFileDto {
  @IsOptional()
  @IsString()
  toUserId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsEnum(SharePermission)
  permission: SharePermission;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean; // ✅ Now valid
}
