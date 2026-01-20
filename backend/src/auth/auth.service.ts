import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { InvitesService } from '../invites/invites.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private invitesService: InvitesService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<User> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Count existing users to bootstrap first user
    const userCount = await this.usersService.count();

    // If no users exist, bootstrap as OWNER
    if (userCount === 0) {
      return this.usersService.create({
        name: registerDto.name,
        email: registerDto.email,
        password: registerDto.password,
        role: UserRole.OWNER,
      });
    }

    // Otherwise normal rules apply
    const publicRegistration =
      this.configService.get('PUBLIC_REGISTRATION') === 'true';

    if (!publicRegistration && !registerDto.inviteToken) {
      throw new ForbiddenException('Invitation required to register');
    }

    let role: UserRole = UserRole.USER;

    if (registerDto.inviteToken) {
      const invitation = await this.invitesService.validateToken(
        registerDto.inviteToken,
      );
      if (!invitation) {
        throw new ForbiddenException('Invalid or expired invitation');
      }
      role = (invitation.role as UserRole) ?? UserRole.USER;
      await this.invitesService.markAsAccepted(invitation.id);
    }

    return this.usersService.create({
      name: registerDto.name,
      email: registerDto.email,
      password: registerDto.password,
      role,
    });
  }

  async login(loginDto: LoginDto): Promise<User> {
  const user = await this.usersService.findByEmail(loginDto.email);
  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const isPasswordValid = await this.usersService.validatePassword(
    user,
    loginDto.password,
  );

  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid credentials');
  }

  return user;
}

  generateJwtToken(user: User): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }
}
