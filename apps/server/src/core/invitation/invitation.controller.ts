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
import { InvitationService } from './invitation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../user/entities/user.entity';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UserService } from '../user/user.service';

@Controller('invites')
export class InvitationController {
  constructor(
    private invitationService: InvitationService,
    private userService: UserService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  create(@CurrentUser() user: User, @Body() createInviteDto: CreateInviteDto) {
    return this.invitationService.create(createInviteDto, user.id, user.name);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.invitationService.findAll();
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  async revoke(@Param('id') id: string) {
    await this.invitationService.revoke(id);
    return { success: true };
  }

  @Post('accept')
  @HttpCode(HttpStatus.CREATED)
  async accept(@Body() acceptDto: AcceptInviteDto) {
    const invitation = await this.invitationService.validateToken(
      acceptDto.token,
    );
    if (!invitation) {
      throw new ForbiddenException('Invalid or expired invitation');
    }

    const user = await this.userService.create({
      name: acceptDto.name,
      email: acceptDto.email,
      password: acceptDto.password,
      role: (invitation.role as UserRole) ?? UserRole.USER,
    });

    await this.invitationService.markAsAccepted(invitation.id);

    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
