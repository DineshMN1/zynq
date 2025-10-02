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

  @ManyToOne(() => File, (file) => file.shares)
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
}