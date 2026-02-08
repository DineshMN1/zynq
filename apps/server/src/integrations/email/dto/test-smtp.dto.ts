import { IsEmail, IsOptional } from 'class-validator';

export class TestSmtpDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid recipient email.' })
  email?: string;
}
