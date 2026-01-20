import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export class CreateInviteDto {
  @IsEmail()
  email: string;

  @IsEnum(UserRole, { message: 'Role must be a valid user role' })
  role: UserRole;
}