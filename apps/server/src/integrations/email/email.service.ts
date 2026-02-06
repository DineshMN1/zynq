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
        pass: (await this.settingService.getGlobalSetting('smtp_pass')) || '',
        from: (await this.settingService.getGlobalSetting('smtp_from')) || '',
      };
    }

    // Fallback to env vars
    return {
      host: this.configService.get('SMTP_HOST') || '',
      port: parseInt(this.configService.get('SMTP_PORT') || '587', 10),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      user: this.configService.get('SMTP_USER') || '',
      pass: this.configService.get('SMTP_PASS') || '',
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

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're invited to zynqCloud</h1>
            </div>
            <div class="content">
              <p>Hi,</p>
              <p><strong>${inviterName}</strong> invited you to join zynqCloud for secure, self-hosted file management.</p>
              <p>Click the button below to register (valid until ${expiresAt.toLocaleDateString()}):</p>
              <div style="text-align: center;">
                <a href="${inviteLink}" class="button">Accept Invitation</a>
              </div>
              <p>Or copy this link:</p>
              <p style="background: #e5e7eb; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px;">
                ${inviteLink}
              </p>
              <p>If you did not request this invite, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} zynqCloud. Self-hosted file management platform.</p>
            </div>
          </div>
        </body>
      </html>
    `;

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

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>We received a request to reset your password. Click the button below to set a new password:</p>
              <div style="text-align: center;">
                <a href="${resetLink}" class="button">Reset Password</a>
              </div>
              <p>Or copy this link:</p>
              <p style="background: #e5e7eb; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px;">
                ${resetLink}
              </p>
              <p>This link expires in 1 hour.</p>
              <p>If you did not request a password reset, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} zynqCloud. Self-hosted file management platform.</p>
            </div>
          </div>
        </body>
      </html>
    `;

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
}
