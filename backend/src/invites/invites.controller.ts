import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UsersService } from '../users/users.service';

@Controller('invites')
export class InvitesController {
  constructor(
    private invitesService: InvitesService,
    private usersService: UsersService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  create(@CurrentUser() user: User, @Body() createInviteDto: CreateInviteDto) {
    return this.invitesService.create(createInviteDto, user.id, user.name);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.invitesService.findAll();
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  async revoke(@Param('id') id: string) {
    await this.invitesService.revoke(id);
    return { success: true };
  }

  @Post('accept')
  @HttpCode(HttpStatus.CREATED)
  async accept(@Body() acceptDto: AcceptInviteDto) {
    const invitation = await this.invitesService.validateToken(acceptDto.token);
    if (!invitation) {
      throw new ForbiddenException('Invalid or expired invitation');
    }

    const user = await this.usersService.create({
      name: acceptDto.name,
      email: acceptDto.email,
      password: acceptDto.password,
      role: (invitation.role as UserRole) ?? UserRole.USER,
    });

    await this.invitesService.markAsAccepted(invitation.id);

    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}