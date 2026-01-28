import { IsString, IsEmail, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
