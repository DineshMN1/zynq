import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';

const DEFAULT_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024; // 10GB in bytes

/**
 * Manages user CRUD operations, password validation, and storage quota tracking.
 */
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Creates a new user with hashed password.
   * @param data - User creation data
   * @returns Created user entity
   */
  async create(data: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<User> {
    const password_hash = await bcrypt.hash(data.password, 12);
    const userRole = data.role ?? UserRole.USER;

    // Admin and Owner get unlimited storage (0), regular users get default limit
    const storageLimit =
      userRole === UserRole.ADMIN || userRole === UserRole.OWNER
        ? 0 // Unlimited for admins
        : DEFAULT_STORAGE_LIMIT;

    const user = this.usersRepository.create({
      name: data.name,
      email: data.email,
      password_hash,
      role: userRole,
      storage_limit: storageLimit,
    });

    return this.usersRepository.save(user);
  }

  /**
   * Finds user by email, including password_hash for authentication.
   * @param email - User's email address
   * @returns User entity with password_hash or null
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.email = :email', { email })
      .getOne();
  }

  /** Finds user by ID. */
  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * Returns paginated list of all users.
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   */
  async findAll(
    page = 1,
    limit = 50,
  ): Promise<{ items: User[]; total: number }> {
    const [items, total] = await this.usersRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { items, total };
  }

  /**
   * Updates user fields.
   * @throws NotFoundException if user doesn't exist
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, data);
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** Permanently deletes a user and their data. */
  async delete(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  /** Validates password against stored bcrypt hash. */
  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }

  /**
   * Adjusts user's storage_used by delta bytes. Never goes below 0.
   * @param userId - User ID
   * @param delta - Bytes to add (positive) or subtract (negative)
   */
  async updateStorageUsed(userId: string, delta: number): Promise<void> {
    await this.usersRepository
      .createQueryBuilder()
      .update()
      .set({
        storage_used: () => `GREATEST(0, COALESCE(storage_used, 0) + :delta)`,
      })
      .where('id = :id', { id: userId })
      .setParameter('delta', delta)
      .execute();
  }

  /**
   * Sets user's storage quota limit in bytes.
   * @param newLimit - New storage limit in bytes (0 = unlimited)
   * @throws NotFoundException if user doesn't exist
   */
  async updateStorageLimit(userId: string, newLimit: number): Promise<User> {
    const flooredLimit = Math.floor(newLimit);
    await this.usersRepository
      .createQueryBuilder()
      .update()
      .set({
        storage_limit: () => ':newLimit',
      })
      .where('id = :id', { id: userId })
      .setParameter('newLimit', flooredLimit)
      .execute();

    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** Returns total number of registered users. */
  async count(): Promise<number> {
    return this.usersRepository.count();
  }
}
