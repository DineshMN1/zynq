import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from '../user.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { UpdateUserDto } from '../dto/update-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class AdminController {
  constructor(private userService: UserService) {}

  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { items, total } = await this.userService.findAll(
      parseInt(page) || 1,
      parseInt(limit) || 50,
    );

    const usersWithoutPasswords = items.map((user) => {
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return {
      items: usersWithoutPasswords,
      meta: {
        total,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
      },
    };
  }

  @Put('users/:id')
  async updateUser(@Param('id') id: string, @Body() updateDto: UpdateUserDto) {
    const user = await this.userService.update(id, updateDto);
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string) {
    await this.userService.delete(id);
    return { success: true };
  }
}
