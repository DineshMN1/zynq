export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export interface Invitation {
  id: string;
  email: string;
  token?: string;
  role: string;
  status: InvitationStatus;
  created_at: string;
  expires_at: string;
}

export interface CreateInvitationDto {
  email: string;
  role: string;
}

export interface InvitationWithLink extends Invitation {
  link: string;
}
