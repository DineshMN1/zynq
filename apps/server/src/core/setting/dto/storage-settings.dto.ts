import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateStorageSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  default_storage_limit?: number; // bytes, 0 = unlimited

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_storage_limit?: number; // bytes, 0 = no cap
}

export class BulkUpdateStorageLimitDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  storage_limit?: number; // optional override, if not provided uses default
}
