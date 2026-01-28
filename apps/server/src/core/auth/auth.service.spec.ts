import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { InvitationService } from '../invitation/invitation.service';
import { UserRole } from '../user/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let invitationService: jest.Mocked<InvitationService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    role: UserRole.USER,
    storage_used: 0,
    storage_limit: 10737418240,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockOwner = {
    ...mockUser,
    id: 'owner-123',
    role: UserRole.OWNER,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            count: jest.fn(),
            validatePassword: jest.fn(),
          },
        },
        {
          provide: InvitationService,
          useValue: {
            validateToken: jest.fn(),
            markAsAccepted: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    invitationService = module.get(InvitationService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if user already exists', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(
        service.register({
          name: 'Test',
          email: 'test@example.com',
          password: 'Password1!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create first user as OWNER', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.count.mockResolvedValue(0);
      userService.create.mockResolvedValue(mockOwner as any);

      const result = await service.register({
        name: 'First User',
        email: 'first@example.com',
        password: 'Password1!',
      });

      expect(userService.create).toHaveBeenCalledWith({
        name: 'First User',
        email: 'first@example.com',
        password: 'Password1!',
        role: UserRole.OWNER,
      });
      expect(result.role).toBe(UserRole.OWNER);
    });

    it('should throw ForbiddenException if no invitation and public registration disabled', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.count.mockResolvedValue(1);
      configService.get.mockReturnValue('false');

      await expect(
        service.register({
          name: 'Test',
          email: 'test@example.com',
          password: 'Password1!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should register user with valid invitation token', async () => {
      const mockInvitation = {
        id: 'invite-123',
        role: UserRole.ADMIN,
        token: 'valid-token',
      };

      userService.findByEmail.mockResolvedValue(null);
      userService.count.mockResolvedValue(1);
      invitationService.validateToken.mockResolvedValue(mockInvitation as any);
      userService.create.mockResolvedValue({
        ...mockUser,
        role: UserRole.ADMIN,
      } as any);

      await service.register({
        name: 'Invited User',
        email: 'invited@example.com',
        password: 'Password1!',
        inviteToken: 'valid-token',
      });

      expect(invitationService.validateToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(invitationService.markAsAccepted).toHaveBeenCalledWith(
        'invite-123',
      );
      expect(userService.create).toHaveBeenCalledWith({
        name: 'Invited User',
        email: 'invited@example.com',
        password: 'Password1!',
        role: UserRole.ADMIN,
      });
    });

    it('should throw ForbiddenException for invalid invitation token', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.count.mockResolvedValue(1);
      invitationService.validateToken.mockResolvedValue(null);

      await expect(
        service.register({
          name: 'Test',
          email: 'test@example.com',
          password: 'Password1!',
          inviteToken: 'invalid-token',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow public registration when enabled', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.count.mockResolvedValue(1);
      configService.get.mockReturnValue('true');
      userService.create.mockResolvedValue(mockUser as any);

      await service.register({
        name: 'Public User',
        email: 'public@example.com',
        password: 'Password1!',
      });

      expect(userService.create).toHaveBeenCalledWith({
        name: 'Public User',
        email: 'public@example.com',
        password: 'Password1!',
        role: UserRole.USER,
      });
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);
      userService.validatePassword.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return user on successful login', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);
      userService.validatePassword.mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'correct-password',
      });

      expect(result).toEqual(mockUser);
    });
  });

  describe('generateJwtToken', () => {
    it('should generate JWT token with correct payload', () => {
      jwtService.sign.mockReturnValue('mock-jwt-token');

      const token = service.generateJwtToken(mockUser as any);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(token).toBe('mock-jwt-token');
    });
  });
});
