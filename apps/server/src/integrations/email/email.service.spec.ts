import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { SettingService } from '../../core/setting/setting.service';

// Mock nodemailer
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const mockVerify = jest.fn().mockResolvedValue(true);
const mockCreateTransport = jest.fn().mockReturnValue({
  sendMail: mockSendMail,
  verify: mockVerify,
});

jest.mock('nodemailer', () => ({
  createTransport: (...args: any[]) => mockCreateTransport(...args),
}));

describe('EmailService', () => {
  let service: EmailService;
  let _configService: jest.Mocked<ConfigService>;
  let _settingService: jest.Mocked<SettingService>;

  beforeEach(async () => {
    // Reset mocks before each test
    mockSendMail.mockClear();
    mockVerify.mockClear();
    mockCreateTransport.mockClear();
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const env: Record<string, string> = {
                SMTP_HOST: 'smtp.test.com',
                SMTP_PORT: '587',
                SMTP_SECURE: 'false',
                SMTP_USER: 'user@test.com',
                SMTP_PASS: 'password123',
                SMTP_FROM: 'noreply@test.com',
                FRONTEND_URL: 'http://localhost:3000',
              };
              return env[key] || undefined;
            }),
          },
        },
        {
          provide: SettingService,
          useValue: {
            getGlobalSetting: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    _configService = module.get(ConfigService);
    _settingService = module.get(SettingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('testConnection', () => {
    it('should call transporter.verify', async () => {
      const result = await service.testConnection();

      expect(mockCreateTransport).toHaveBeenCalled();
      expect(mockVerify).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('sendInvitationEmail', () => {
    it('should call sendMail with correct to and subject', async () => {
      const expiresAt = new Date('2026-12-31');

      await service.sendInvitationEmail(
        'invited@example.com',
        'http://localhost:3000/invite/token123',
        'Admin User',
        expiresAt,
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'invited@example.com',
          subject: expect.stringContaining('invited'),
        }),
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should call sendMail with correct to and subject', async () => {
      await service.sendPasswordResetEmail(
        'user@example.com',
        'http://localhost:3000/reset/token456',
        'Test User',
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Reset'),
        }),
      );
    });
  });

  describe('sendTestEmail', () => {
    it('should call sendMail', async () => {
      await service.sendTestEmail('receiver@example.com');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'receiver@example.com',
        }),
      );
    });
  });

  describe('invalidateTransporter', () => {
    it('should clear cached transporter so a new one is created', async () => {
      // First call creates the transporter
      await service.testConnection();
      expect(mockCreateTransport).toHaveBeenCalledTimes(1);

      // Second call reuses cached transporter
      await service.testConnection();
      expect(mockCreateTransport).toHaveBeenCalledTimes(1);

      // Invalidate and call again — should create a new transporter
      service.invalidateTransporter();
      await service.testConnection();
      expect(mockCreateTransport).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTransporter caching', () => {
    it('should cache and reuse transporter', async () => {
      await service.testConnection();
      await service.testConnection();
      await service.testConnection();

      // Should only create once despite multiple calls
      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    });
  });
});
