import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateFileDto {
  @IsString()
  name: string;

  @IsNumber()
  size: number;

  @IsString()
  mimeType: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isFolder?: boolean;

  @IsOptional()
  @IsString()
  storagePath?: string;
}