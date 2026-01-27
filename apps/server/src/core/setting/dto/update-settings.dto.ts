import { IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum Theme {
  DARK = 'dark',
  LIGHT = 'light',
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;

  @IsOptional()
  @IsBoolean()
  telemetry?: boolean;
}