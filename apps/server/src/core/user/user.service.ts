import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(data: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<User> {
    const password_hash = await bcrypt.hash(data.password, 12);

    const user = this.usersRepository.create({
      name: data.name,
      email: data.email,
      password_hash,
      role: data.role ?? UserRole.USER,
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

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

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, data);
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async delete(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }

  async updateStorageUsed(userId: string, delta: number): Promise<void> {
    // Use raw query to properly handle both positive and negative deltas
    // and ensure storage_used never goes below 0
    await this.usersRepository
      .createQueryBuilder()
      .update()
      .set({
        storage_used: () => `GREATEST(0, COALESCE(storage_used, 0) + ${delta})`,
      })
      .where('id = :id', { id: userId })
      .execute();
  }

  async updateStorageLimit(userId: string, newLimit: number): Promise<User> {
    // Use raw query to properly handle bigint values
    await this.usersRepository
      .createQueryBuilder()
      .update()
      .set({
        storage_limit: () => `${Math.floor(newLimit)}`,
      })
      .where('id = :id', { id: userId })
      .execute();

    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async count(): Promise<number> {
    return this.usersRepository.count();
  }
}
