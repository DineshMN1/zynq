import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../user/entities/user.entity';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

@Entity('invitations')
export class Invitation extends BaseEntity {
  @Column()
  email: string;

  @Column({ unique: true })
  token: string;

  @Column({ default: 'user' })
  role: string;

  @Column({ nullable: true })
  inviter_id: string;

  @ManyToOne(() => User, (user) => user.invitations, { nullable: true })
  @JoinColumn({ name: 'inviter_id' })
  inviter: User;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Column({ type: 'timestamptz' })
  expires_at: Date;
}
