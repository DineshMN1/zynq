import { IsString, IsOptional, IsEnum } from 'class-validator';
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
}