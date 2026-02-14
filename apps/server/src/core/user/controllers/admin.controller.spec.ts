import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { UserService } from '../user.service';
import { UserRole } from '../entities/user.entity';

describe('AdminController', () => {
  let controller: AdminController;
  let userService: jest.Mocked<UserService>;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: UserService,
          useValue: {
            findAll: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    userService = module.get(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsers', () => {
    it('should return paginated users without password_hash', async () => {
      const users = [
        mockUser,
        { ...mockUser, id: 'user-456', name: 'User Two' },
      ];
      userService.findAll.mockResolvedValue({ items: users as any, total: 2 });

      const result = await controller.getUsers('1', '50');

      expect(userService.findAll).toHaveBeenCalledWith(1, 50);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).not.toHaveProperty('password_hash');
      expect(result.items[1]).not.toHaveProperty('password_hash');
      expect(result.items[0]).toHaveProperty('email', 'test@example.com');
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 50 });
    });

    it('should use default page and limit when not provided', async () => {
      userService.findAll.mockResolvedValue({ items: [] as any, total: 0 });

      await controller.getUsers(undefined, undefined);

      expect(userService.findAll).toHaveBeenCalledWith(1, 50);
    });
  });

  describe('updateUser', () => {
    it('should return updated user without password_hash', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      userService.update.mockResolvedValue(updatedUser as any);

      const result = await controller.updateUser('user-123', {
        name: 'Updated Name',
      } as any);

      expect(userService.update).toHaveBeenCalledWith('user-123', {
        name: 'Updated Name',
      });
      expect(result).not.toHaveProperty('password_hash');
      expect(result).toHaveProperty('name', 'Updated Name');
    });
  });

  describe('deleteUser', () => {
    it('should delegate to userService.delete and return success', async () => {
      userService.delete.mockResolvedValue(undefined);

      const result = await controller.deleteUser('user-123');

      expect(userService.delete).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ success: true });
    });
  });
});
