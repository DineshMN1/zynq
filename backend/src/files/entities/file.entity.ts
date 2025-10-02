import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Share } from './share.entity';

@Entity('files')
export class File extends BaseEntity {
  @Column()
  owner_id: string;

  @ManyToOne(() => User, (user) => user.files)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column()
  name: string;

  @Column({ nullable: true })
  mime_type: string;

  @Column({ type: 'bigint', default: 0 })
  size: number;

  @Column({ nullable: true })
  storage_path: string;

  @Column({ nullable: true })
  parent_id: string;

  @ManyToOne(() => File, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: File;

  @Column({ default: false })
  is_folder: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date;

  @OneToMany(() => Share, (share) => share.file)
  shares: Share[];
}