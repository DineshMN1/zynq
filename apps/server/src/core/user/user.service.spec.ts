import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { User, UserRole } from './entities/user.entity';

jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<Repository<User>>;

  const mockUser: Partial<User> = {
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

  const mockQueryBuilder = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            increment: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const createData = {
        name: 'New User',
        email: 'new@example.com',
        password: 'Password1!',
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      repository.create.mockReturnValue(mockUser as User);
      repository.save.mockResolvedValue(mockUser as User);

      const result = await service.create(createData);

      expect(bcrypt.hash).toHaveBeenCalledWith('Password1!', 12);
      expect(repository.create).toHaveBeenCalledWith({
        name: 'New User',
        email: 'new@example.com',
        password_hash: 'hashed_password',
        role: UserRole.USER,
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should create user with specified role', async () => {
      const createData = {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'Password1!',
        role: UserRole.ADMIN,
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      repository.create.mockReturnValue({
        ...mockUser,
        role: UserRole.ADMIN,
      } as User);
      repository.save.mockResolvedValue({
        ...mockUser,
        role: UserRole.ADMIN,
      } as User);

      await service.create(createData);

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Admin User',
        email: 'admin@example.com',
        password_hash: 'hashed_password',
        role: UserRole.ADMIN,
      });
    });
  });

  describe('findByEmail', () => {
    it('should find user by email with password hash', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'user.password_hash',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'user.email = :email',
        {
          email: 'test@example.com',
        },
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      repository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findById('user-123');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-456' }];
      repository.findAndCount.mockResolvedValue([users as User[], 2]);

      const result = await service.findAll(1, 50);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 50,
        order: { created_at: 'DESC' },
      });
      expect(result).toEqual({ items: users, total: 2 });
    });

    it('should handle pagination correctly', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(2, 10);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('update', () => {
    it('should update user and return updated user', async () => {
      const updateData = { name: 'Updated Name' };
      repository.findOne.mockResolvedValue({
        ...mockUser,
        name: 'Updated Name',
      } as User);

      const result = await service.update('user-123', updateData);

      expect(repository.update).toHaveBeenCalledWith('user-123', updateData);
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException if user not found after update', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      await service.delete('user-123');

      expect(repository.delete).toHaveBeenCalledWith('user-123');
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validatePassword(
        mockUser as User,
        'correct-password',
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correct-password',
        'hashed_password',
      );
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validatePassword(
        mockUser as User,
        'wrong-password',
      );

      expect(result).toBe(false);
    });
  });

  describe('updateStorageUsed', () => {
    it('should increment storage used', async () => {
      await service.updateStorageUsed('user-123', 1000);

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: 'user-123',
      });
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });

    it('should decrement storage used with negative delta', async () => {
      await service.updateStorageUsed('user-123', -500);

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });
  });

  describe('count', () => {
    it('should return total user count', async () => {
      repository.count.mockResolvedValue(5);

      const result = await service.count();

      expect(result).toBe(5);
    });
  });
});
