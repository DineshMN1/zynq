import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { InvitationService } from '../invitation/invitation.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserRole } from '../user/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private invitationService: InvitationService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<User> {
    const existingUser = await this.userService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const userCount = await this.userService.count();

    if (userCount === 0) {
      return this.userService.create({
        name: registerDto.name,
        email: registerDto.email,
        password: registerDto.password,
        role: UserRole.OWNER,
      });
    }

    const publicRegistration =
      this.configService.get('PUBLIC_REGISTRATION') === 'true';

    if (!publicRegistration && !registerDto.inviteToken) {
      throw new ForbiddenException('Invitation required to register');
    }

    let role: UserRole = UserRole.USER;

    if (registerDto.inviteToken) {
      const invitation = await this.invitationService.validateToken(
        registerDto.inviteToken,
      );
      if (!invitation) {
        throw new ForbiddenException('Invalid or expired invitation');
      }
      role = (invitation.role as UserRole) ?? UserRole.USER;
      await this.invitationService.markAsAccepted(invitation.id);
    }

    return this.userService.create({
      name: registerDto.name,
      email: registerDto.email,
      password: registerDto.password,
      role,
    });
  }

  async login(loginDto: LoginDto): Promise<User> {
    const user = await this.userService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.userService.validatePassword(
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
