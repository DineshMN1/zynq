import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendInvitationEmail(
    email: string,
    inviteLink: string,
    inviterName: string,
    expiresAt: Date,
  ): Promise<void> {
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
              <p>© ${new Date().getFullYear()} zynqCloud. Self-hosted file management platform.</p>
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

    await this.transporter.sendMail({
      from: this.configService.get('SMTP_FROM'),
      to: email,
      subject: "You're invited to zynqCloud — join your organization",
      text: textContent,
      html: htmlContent,
    });
  }
}