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
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserRole } from '../user/entities/user.entity';
import { PasswordReset } from './entities/password-reset.entity';

/**
 * Handles user authentication, registration, and password management.
 * Manages JWT token generation, login/logout, and password reset flows.
 */
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

  /**
   * Registers a new user. First user becomes OWNER automatically.
   * Subsequent users require invitation or PUBLIC_REGISTRATION=true.
   * @param registerDto - Registration data (name, email, password, optional inviteToken)
   * @returns Created user entity
   * @throws ConflictException if email already exists
   * @throws ForbiddenException if registration is closed and no valid invite
   */
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

  /**
   * Authenticates user with email and password.
   * @param loginDto - Login credentials
   * @returns User entity if credentials are valid
   * @throws UnauthorizedException if credentials are invalid
   */
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

  /**
   * Generates a JWT token for authenticated user.
   * @param user - User entity to generate token for
   * @returns Signed JWT token string
   */
  generateJwtToken(user: User): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }

  /**
   * Checks if initial setup is required (no users exist).
   * @returns true if no users in database, false otherwise
   */
  async needsSetup(): Promise<boolean> {
    const userCount = await this.userService.count();
    return userCount === 0;
  }

  /**
   * Initiates password reset flow. Creates reset token and sends email.
   * Always returns success message to prevent email enumeration.
   * @param email - User's email address
   * @returns Generic success message regardless of email existence
   */
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

  /**
   * Resets user password using valid reset token.
   * Token is invalidated after use. Password is hashed with bcrypt.
   * @param token - Password reset token from email
   * @param newPassword - New password to set
   * @returns Success message
   * @throws UnauthorizedException if token is invalid or expired
   */
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

  /**
   * Updates user profile information.
   * @param userId - ID of the user to update
   * @param updateProfileDto - Profile data to update
   * @returns Updated user entity
   */
  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<User> {
    return this.userService.update(userId, { name: updateProfileDto.name });
  }

  /**
   * Changes user password after verifying current password.
   * @param userId - ID of the user
   * @param currentPassword - Current password for verification
   * @param newPassword - New password to set
   * @throws UnauthorizedException if current password is incorrect
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Get user with password hash
    const userWithPassword = await this.userService.findByEmail(user.email);
    if (!userWithPassword) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await this.userService.validatePassword(
      userWithPassword,
      currentPassword,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userService.update(userId, { password_hash: passwordHash } as any);
  }
}
