import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Invitation, InvitationStatus } from './entities/invitation.entity';
import { EmailService } from '../email/email.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(Invitation)
    private invitationsRepository: Repository<Invitation>,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async create(
    createInviteDto: CreateInviteDto,
    inviterId: string,
    inviterName: string,
  ): Promise<Invitation & { link: string }> {
    const token = uuidv4();
    const ttlHours = parseInt(
      this.configService.get('INVITE_TOKEN_TTL_HOURS') || '72',
    );
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    const invitation = this.invitationsRepository.create({
      email: createInviteDto.email,
      token,
      role: createInviteDto.role,
      inviter_id: inviterId,
      expires_at: expiresAt,
    });

    const saved = await this.invitationsRepository.save(invitation);

    const frontendUrl = this.configService.get('FRONTEND_URL');
    const link = `${frontendUrl}/register?inviteToken=${token}`;

    try {
      await this.emailService.sendInvitationEmail(
        createInviteDto.email,
        link,
        inviterName,
        expiresAt,
      );
    } catch (error) {
      console.error('Failed to send invitation email:', error);
    }

    return { ...saved, link };
  }

  async findAll(): Promise<Invitation[]> {
    return this.invitationsRepository.find({
      where: { status: InvitationStatus.PENDING },
      order: { created_at: 'DESC' },
    });
  }

  async revoke(id: string): Promise<void> {
    const invitation = await this.invitationsRepository.findOne({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    invitation.status = InvitationStatus.REVOKED;
    await this.invitationsRepository.save(invitation);
  }

  async validateToken(token: string): Promise<Invitation | null> {
    const invitation = await this.invitationsRepository.findOne({
      where: { token, status: InvitationStatus.PENDING },
    });

    if (!invitation) {
      return null;
    }

    if (invitation.expires_at < new Date()) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationsRepository.save(invitation);
      return null;
    }

    return invitation;
  }

  async markAsAccepted(id: string): Promise<void> {
    await this.invitationsRepository.update(id, {
      status: InvitationStatus.ACCEPTED,
    });
  }

  async cleanExpired(): Promise<void> {
    await this.invitationsRepository.update(
      {
        expires_at: LessThan(new Date()),
        status: InvitationStatus.PENDING,
      },
      { status: InvitationStatus.EXPIRED },
    );
  }
}