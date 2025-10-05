import { Entity, Column, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../common/entities/base.entity';
import { File } from '../../files/entities/file.entity';
import { Invitation } from '../../invites/entities/invitation.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  OWNER = 'owner',
}

@Entity('users')
export class User extends BaseEntity {
  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  @Exclude({ toPlainOnly: true })
  password_hash: string;

  // ✅ Add this getter alias so user.password works everywhere
  get password(): string {
    return this.password_hash;
  }

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ type: 'bigint', default: 0 })
  storage_used: number;

  @Column({ type: 'bigint', default: 10737418240 })
  storage_limit: number;

  @OneToMany(() => File, (file) => file.owner)
  files: File[];

  @OneToMany(() => Invitation, (invitation) => invitation.inviter)
  invitations: Invitation[];
}
