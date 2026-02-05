import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserService } from '../user/user.service';
import { InvitationService } from '../invitation/invitation.service';
import { EmailService } from '../../integrations/email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserRole } from '../user/entities/user.entity';
import { PasswordReset } from './entities/password-reset.entity';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private invitationService: InvitationService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
    private emailService: EmailService,
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

  async needsSetup(): Promise<boolean> {
    const userCount = await this.userService.count();
    return userCount === 0;
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Invalidate any existing unused tokens for this user
    await this.passwordResetRepository.update(
      { user_id: user.id, used_at: IsNull() },
      { used_at: new Date() },
    );

    // Create new token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const resetRecord = this.passwordResetRepository.create({
      user_id: user.id,
      token,
      expires_at: expiresAt,
    });
    await this.passwordResetRepository.save(resetRecord);

    // Send email
    const frontendUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        resetLink,
        user.name,
      );
    } catch (error) {
      console.warn(
        'Failed to send password reset email:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      // Don't throw -- still return generic message
    }

    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const resetRecord = await this.passwordResetRepository.findOne({
      where: { token, used_at: IsNull() },
    });

    if (!resetRecord) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (resetRecord.expires_at < new Date()) {
      throw new UnauthorizedException('Reset token has expired');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user password
    await this.userService.update(resetRecord.user_id, {
      password_hash: passwordHash,
    } as any);

    // Mark token as used
    resetRecord.used_at = new Date();
    await this.passwordResetRepository.save(resetRecord);

    return { message: 'Password has been reset successfully.' };
  }
}
