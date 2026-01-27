import { IsOptional, IsEnum, IsNumber } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(UserRole, { message: 'role must be user, admin, or owner' })
  role?: UserRole;

  @IsOptional()
  @IsNumber()
  storage_limit?: number;
}
