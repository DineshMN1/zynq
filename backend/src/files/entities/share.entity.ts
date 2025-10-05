import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { File } from './file.entity';
import { User } from '../../users/entities/user.entity';

export enum SharePermission {
  READ = 'read',
  WRITE = 'write',
}

@Entity('shares')
export class Share extends BaseEntity {
  @Column()
  file_id: string;

  @ManyToOne(() => File, (file) => file.shares, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file: File;

  @Column({ nullable: true })
  grantee_user_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'grantee_user_id' })
  grantee_user: User;

  @Column({ nullable: true })
  grantee_email: string;

  @Column({
    type: 'enum',
    enum: SharePermission,
    default: SharePermission.READ,
  })
  permission: SharePermission;

  @Column()
  created_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  // -------------------------------
  //  New Public Sharing Fields
  // -------------------------------

  @Column({ default: false })
  is_public: boolean;

  @Column({ nullable: true, unique: true })
  share_token?: string; // e.g. randomBytes(16).toString('hex')

  @Column({ nullable: true, type: 'timestamp' })
  expires_at?: Date; // optional expiry (7 days, etc.)

  @Column({ nullable: true })
  password?: string; // optional for protected links
}
