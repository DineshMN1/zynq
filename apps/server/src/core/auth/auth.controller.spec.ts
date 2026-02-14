import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from '../user/entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
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

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            needsSetup: jest.fn(),
            register: jest.fn(),
            login: jest.fn(),
            generateJwtToken: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
            updateProfile: jest.fn(),
            changePassword: jest.fn(),
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

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSetupStatus', () => {
    it('should return needsSetup from service', async () => {
      authService.needsSetup.mockResolvedValue(true);

      const result = await controller.getSetupStatus();

      expect(result).toEqual({ needsSetup: true });
      expect(authService.needsSetup).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should call authService.register, generate token, set cookie, and strip password_hash', async () => {
      const registerDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password1!',
      };
      authService.register.mockResolvedValue(mockUser as any);
      authService.generateJwtToken.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue('development');

      const result = await controller.register(registerDto, mockResponse);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(authService.generateJwtToken).toHaveBeenCalledWith(mockUser);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'jid',
        'mock-jwt-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        }),
      );
      expect(result).not.toHaveProperty('password_hash');
      expect(result).toHaveProperty('token', 'mock-jwt-token');
      expect(result).toHaveProperty('email', 'test@example.com');
    });
  });

  describe('login', () => {
    it('should call authService.login, generate token, set cookie, and strip password_hash', async () => {
      const loginDto = { email: 'test@example.com', password: 'Password1!' };
      authService.login.mockResolvedValue(mockUser as any);
      authService.generateJwtToken.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue('development');

      const result = await controller.login(loginDto, mockResponse);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(authService.generateJwtToken).toHaveBeenCalledWith(mockUser);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'jid',
        'mock-jwt-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        }),
      );
      expect(result).not.toHaveProperty('password_hash');
      expect(result).toHaveProperty('token', 'mock-jwt-token');
    });
  });

  describe('forgotPassword', () => {
    it('should delegate to authService', async () => {
      const expectedResponse = {
        message: 'If the email exists, a reset link has been sent',
      };
      authService.forgotPassword.mockResolvedValue(expectedResponse);

      const result = await controller.forgotPassword({
        email: 'test@example.com',
      });

      expect(authService.forgotPassword).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('resetPassword', () => {
    it('should delegate to authService', async () => {
      const expectedResponse = { message: 'Password reset successfully' };
      authService.resetPassword.mockResolvedValue(expectedResponse);

      const result = await controller.resetPassword({
        token: 'reset-token',
        password: 'NewPassword1!',
      });

      expect(authService.resetPassword).toHaveBeenCalledWith(
        'reset-token',
        'NewPassword1!',
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('logout', () => {
    it('should clear jid cookie and return success', () => {
      const result = controller.logout(mockResponse);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('jid');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getProfile', () => {
    it('should strip password_hash from user', () => {
      const result = controller.getProfile(mockUser as any);

      expect(result).not.toHaveProperty('password_hash');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('name', 'Test User');
    });
  });

  describe('updateProfile', () => {
    it('should strip password_hash from result', async () => {
      const updateDto = { name: 'Updated Name' };
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      authService.updateProfile.mockResolvedValue(updatedUser as any);

      const result = await controller.updateProfile(mockUser as any, updateDto);

      expect(authService.updateProfile).toHaveBeenCalledWith(
        'user-123',
        updateDto,
      );
      expect(result).not.toHaveProperty('password_hash');
      expect(result).toHaveProperty('name', 'Updated Name');
    });
  });

  describe('changePassword', () => {
    it('should delegate to authService and return success message', async () => {
      authService.changePassword.mockResolvedValue(undefined);

      const result = await controller.changePassword(mockUser as any, {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword1!',
      });

      expect(authService.changePassword).toHaveBeenCalledWith(
        'user-123',
        'OldPassword1!',
        'NewPassword1!',
      );
      expect(result).toEqual({ message: 'Password changed successfully' });
    });
  });
});
