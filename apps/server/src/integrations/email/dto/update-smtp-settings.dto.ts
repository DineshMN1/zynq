import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class UpdateSmtpSettingsDto {
  @IsString()
  smtp_host: string;

  @IsNumber()
  smtp_port: number;

  @IsBoolean()
  smtp_secure: boolean;

  @IsOptional()
  @IsString()
  smtp_user?: string;

  @IsOptional()
  @IsString()
  smtp_pass?: string;

  @IsString()
  smtp_from: string;
}
