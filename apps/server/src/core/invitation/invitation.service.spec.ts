import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { Invitation, InvitationStatus } from './entities/invitation.entity';
import { UserRole } from '../user/entities/user.entity';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-invite-token'),
}));

describe('InvitationService', () => {
  let service: InvitationService;
  let repository: jest.Mocked<Repository<Invitation>>;
  let configService: jest.Mocked<ConfigService>;

  const mockInvitation: Partial<Invitation> = {
    id: 'invite-123',
    email: 'invited@example.com',
    token: 'test-invite-token',
    role: UserRole.USER,
    inviter_id: 'user-123',
    status: InvitationStatus.PENDING,
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000),
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    // Reset environment variable
    delete process.env.EMAIL_ENABLED;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        {
          provide: getRepositoryToken(Invitation),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                INVITE_TOKEN_TTL_HOURS: '72',
                FRONTEND_URL: 'http://localhost:3000',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
    repository = module.get(getRepositoryToken(Invitation));
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an invitation with link', async () => {
      repository.create.mockReturnValue(mockInvitation as Invitation);
      repository.save.mockResolvedValue(mockInvitation as Invitation);

      const result = await service.create(
        { email: 'invited@example.com', role: UserRole.USER },
        'user-123',
        'Test Inviter',
      );

      expect(repository.create).toHaveBeenCalledWith({
        email: 'invited@example.com',
        token: 'test-invite-token',
        role: UserRole.USER,
        inviter_id: 'user-123',
        expires_at: expect.any(Date),
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result.link).toBe('http://localhost:3000/register?inviteToken=test-invite-token');
    });

    it('should create admin invitation', async () => {
      const adminInvite = { ...mockInvitation, role: UserRole.ADMIN };
      repository.create.mockReturnValue(adminInvite as Invitation);
      repository.save.mockResolvedValue(adminInvite as Invitation);

      const result = await service.create(
        { email: 'admin@example.com', role: UserRole.ADMIN },
        'owner-123',
        'Owner User',
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ADMIN }),
      );
    });
  });

  describe('findAll', () => {
    it('should return pending invitations', async () => {
      repository.find.mockResolvedValue([mockInvitation as Invitation]);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
        where: { status: InvitationStatus.PENDING },
        order: { created_at: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('revoke', () => {
    it('should revoke an invitation', async () => {
      repository.findOne.mockResolvedValue(mockInvitation as Invitation);
      repository.save.mockResolvedValue({
        ...mockInvitation,
        status: InvitationStatus.REVOKED,
      } as Invitation);

      await service.revoke('invite-123');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.REVOKED }),
      );
    });

    it('should throw NotFoundException if invitation not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.revoke('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateToken', () => {
    it('should return valid invitation', async () => {
      repository.findOne.mockResolvedValue(mockInvitation as Invitation);

      const result = await service.validateToken('test-invite-token');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { token: 'test-invite-token', status: InvitationStatus.PENDING },
      });
      expect(result).toEqual(mockInvitation);
    });

    it('should return null for non-existent token', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.validateToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should mark expired invitation and return null', async () => {
      const expiredInvitation = {
        ...mockInvitation,
        expires_at: new Date(Date.now() - 1000),
      };
      repository.findOne.mockResolvedValue(expiredInvitation as Invitation);

      const result = await service.validateToken('test-invite-token');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.EXPIRED }),
      );
      expect(result).toBeNull();
    });
  });

  describe('markAsAccepted', () => {
    it('should mark invitation as accepted', async () => {
      await service.markAsAccepted('invite-123');

      expect(repository.update).toHaveBeenCalledWith('invite-123', {
        status: InvitationStatus.ACCEPTED,
      });
    });
  });

  describe('cleanExpired', () => {
    it('should update expired invitations', async () => {
      await service.cleanExpired();

      expect(repository.update).toHaveBeenCalledWith(
        { expires_at: expect.any(Object), status: InvitationStatus.PENDING },
        { status: InvitationStatus.EXPIRED },
      );
    });
  });
});
