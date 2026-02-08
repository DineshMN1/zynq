import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SettingService } from '../../core/setting/setting.service';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

function normalizeSmtpPassword(value: string): string {
  if (!value) return value;
  // Some providers show app passwords with spaces for readability.
  return value.replace(/\s+/g, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '#';
    return encodeURI(url.toString());
  } catch {
    return '#';
  }
}

function buildBaseEmailHtml(params: {
  title: string;
  intro: string;
  buttonLabel: string;
  buttonUrl: string;
  footerNote: string;
  extra?: string;
}): string {
  const { title, intro, buttonLabel, buttonUrl, footerNote, extra } = params;
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeButtonLabel = escapeHtml(buttonLabel);
  const safeFooter = escapeHtml(footerNote);
  const safeExtra = extra ? escapeHtml(extra) : '';
  const safeUrl = sanitizeUrl(buttonUrl);
  const safeUrlText = escapeHtml(buttonUrl);
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #111827; background: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; padding: 24px; }
            .card { background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
            .header { background: #111827; color: #ffffff; padding: 24px; text-align: center; }
            .content { padding: 24px; }
            .button { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 22px; text-decoration: none; border-radius: 8px; font-weight: 600; }
            .muted { color: #6b7280; font-size: 13px; }
            .link-box { background: #f9fafb; padding: 12px; border-radius: 8px; word-break: break-all; font-size: 12px; border: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <h1 style="margin: 0; font-size: 22px;">${safeTitle}</h1>
              </div>
              <div class="content">
                <p>${safeIntro}</p>
                <div style="text-align: center; margin: 20px 0;">
                  <a href="${safeUrl}" class="button">${safeButtonLabel}</a>
                </div>
                <p class="muted">If the button doesn&apos;t work, copy and paste this link:</p>
                <div class="link-box">${safeUrlText}</div>
                ${safeExtra ? `<div style="margin-top: 16px;">${safeExtra}</div>` : ''}
                <p class="muted" style="margin-top: 20px;">${safeFooter}</p>
              </div>
            </div>
            <p class="muted" style="text-align: center; margin-top: 16px;">
              &copy; ${new Date().getFullYear()} zynqCloud
            </p>
          </div>
        </body>
      </html>
    `;
}

/**
 * Handles SMTP email sending for invitations and password resets.
 * Supports DB-first config with env var fallback. Caches transporter.
 */
@Injectable()
export class EmailService {
  private cachedTransporter: nodemailer.Transporter | null = null;
  private cachedConfigHash: string | null = null;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => SettingService))
    private settingService: SettingService,
  ) {}

  private async getSmtpConfig(): Promise<SmtpConfig> {
    // Try DB settings first
    const dbHost = await this.settingService.getGlobalSetting('smtp_host');
    if (dbHost) {
      return {
        host: dbHost,
        port: (await this.settingService.getGlobalSetting('smtp_port')) || 587,
        secure:
          (await this.settingService.getGlobalSetting('smtp_secure')) || false,
        user: (await this.settingService.getGlobalSetting('smtp_user')) || '',
        pass: normalizeSmtpPassword(
          (await this.settingService.getGlobalSetting('smtp_pass')) || '',
        ),
        from: (await this.settingService.getGlobalSetting('smtp_from')) || '',
      };
    }

    // Fallback to env vars
    return {
      host: this.configService.get('SMTP_HOST') || '',
      port: parseInt(this.configService.get('SMTP_PORT') || '587', 10),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      user: this.configService.get('SMTP_USER') || '',
      pass: normalizeSmtpPassword(this.configService.get('SMTP_PASS') || ''),
      from:
        this.configService.get('SMTP_FROM') || 'zynqCloud <no-reply@localhost>',
    };
  }

  private async getTransporter(): Promise<nodemailer.Transporter> {
    const config = await this.getSmtpConfig();
    const configHash = JSON.stringify(config);

    if (this.cachedTransporter && this.cachedConfigHash === configHash) {
      return this.cachedTransporter;
    }

    this.cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    this.cachedConfigHash = configHash;
    return this.cachedTransporter;
  }

  /** Tests SMTP connection. Throws if connection fails. */
  async testConnection(): Promise<boolean> {
    const transporter = await this.getTransporter();
    await transporter.verify();
    return true;
  }

  /** Clears cached transporter. Call after SMTP config changes. */
  invalidateTransporter(): void {
    this.cachedTransporter = null;
    this.cachedConfigHash = null;
  }

  /** Sends invitation email with styled HTML template. */
  async sendInvitationEmail(
    email: string,
    inviteLink: string,
    inviterName: string,
    expiresAt: Date,
  ): Promise<void> {
    const config = await this.getSmtpConfig();
    const transporter = await this.getTransporter();

    const htmlContent = buildBaseEmailHtml({
      title: "You're invited to zynqCloud",
      intro: `<strong>${inviterName}</strong> invited you to join their workspace.`,
      buttonLabel: 'Accept Invitation',
      buttonUrl: inviteLink,
      footerNote: `This invitation expires on ${expiresAt.toLocaleDateString()}. If you did not request this invite, you can ignore this email.`,
    });

    const textContent = `
Hi,

${inviterName} invited you to join zynqCloud. Click the link below to register (valid until ${expiresAt.toLocaleDateString()}):

${inviteLink}

If you did not request this invite, ignore this email.

— zynqCloud
    `;

    await transporter.sendMail({
      from: config.from,
      to: email,
      subject: "You're invited to zynqCloud — join your organization",
      text: textContent,
      html: htmlContent,
    });
  }

  /** Sends password reset email with styled HTML template. */
  async sendPasswordResetEmail(
    email: string,
    resetLink: string,
    userName: string,
  ): Promise<void> {
    const config = await this.getSmtpConfig();
    const transporter = await this.getTransporter();

    const htmlContent = buildBaseEmailHtml({
      title: 'Password Reset',
      intro: `Hi ${userName}, we received a request to reset your password.`,
      buttonLabel: 'Reset Password',
      buttonUrl: resetLink,
      footerNote:
        'This link expires in 1 hour. If you did not request a password reset, you can ignore this email.',
    });

    const textContent = `
Hi ${userName},

We received a request to reset your password. Visit the link below to set a new password (expires in 1 hour):

${resetLink}

If you did not request a password reset, ignore this email.

— zynqCloud
    `;

    await transporter.sendMail({
      from: config.from,
      to: email,
      subject: 'Reset your zynqCloud password',
      text: textContent,
      html: htmlContent,
    });
  }

  /** Sends a basic SMTP test email to a receiver address. */
  async sendTestEmail(receiver: string): Promise<void> {
    const config = await this.getSmtpConfig();
    const transporter = await this.getTransporter();

    const htmlContent = buildBaseEmailHtml({
      title: 'SMTP Test Email',
      intro: 'This is a test email to confirm your SMTP configuration.',
      buttonLabel: 'Open zynqCloud',
      buttonUrl:
        this.configService.get('FRONTEND_URL') || 'http://localhost:3000',
      footerNote: 'If you received this, your SMTP settings are working.',
      extra: 'You can safely ignore this message after confirming delivery.',
    });

    const textContent = `
SMTP Test Email

This is a test email to confirm your SMTP configuration.

If you received this, your SMTP settings are working.
    `;

    await transporter.sendMail({
      from: config.from,
      to: receiver,
      subject: 'SMTP test email from zynqCloud',
      text: textContent,
      html: htmlContent,
    });
  }
}
