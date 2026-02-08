import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { SettingService } from '../../core/setting/setting.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../core/user/entities/user.entity';
import { UpdateSmtpSettingsDto } from './dto/update-smtp-settings.dto';
import { TestSmtpDto } from './dto/test-smtp.dto';

function normalizeSmtpPassword(value?: string): string | undefined {
  if (!value) return value;
  return value.replace(/\s+/g, '');
}

function formatSmtpError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Failed to connect to SMTP server.';
}

@Controller('settings/smtp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class SmtpController {
  constructor(
    private emailService: EmailService,
    private settingService: SettingService,
    private configService: ConfigService,
  ) {}

  @Get()
  async getSmtpSettings() {
    const settings = await this.settingService.getGlobalSettings();
    const hasDbHost = !!settings.smtp_host;

    if (hasDbHost) {
      return {
        smtp_host: settings.smtp_host || '',
        smtp_port: settings.smtp_port || 587,
        smtp_secure: settings.smtp_secure || false,
        smtp_user: settings.smtp_user || '',
        smtp_pass: settings.smtp_pass ? '••••••••' : '',
        smtp_from: settings.smtp_from || '',
        has_password: !!settings.smtp_pass,
      };
    }

    const envHost = this.configService.get('SMTP_HOST') || '';
    const envPort =
      parseInt(this.configService.get('SMTP_PORT') || '587', 10) || 587;
    const envSecure = this.configService.get('SMTP_SECURE') === 'true';
    const envUser = this.configService.get('SMTP_USER') || '';
    const envPass = this.configService.get('SMTP_PASS') || '';
    const envFrom =
      this.configService.get('SMTP_FROM') || 'zynqCloud <no-reply@localhost>';

    return {
      smtp_host: envHost,
      smtp_port: envPort,
      smtp_secure: envSecure,
      smtp_user: envUser,
      smtp_pass: envPass ? '••••••••' : '',
      smtp_from: envFrom,
      has_password: !!envPass,
    };
  }

  @Put()
  async updateSmtpSettings(@Body() dto: UpdateSmtpSettingsDto) {
    const updateData: Record<string, any> = {
      smtp_host: dto.smtp_host,
      smtp_port: dto.smtp_port,
      smtp_secure: dto.smtp_secure,
      smtp_user: dto.smtp_user || '',
      smtp_from: dto.smtp_from,
    };

    // Only update password if a real value is provided (not the mask)
    if (dto.smtp_pass && dto.smtp_pass !== '••••••••') {
      updateData.smtp_pass = normalizeSmtpPassword(dto.smtp_pass);
    }

    const result = await this.settingService.updateGlobalSettings(updateData);
    this.emailService.invalidateTransporter();

    return {
      smtp_host: result.smtp_host || '',
      smtp_port: result.smtp_port || 587,
      smtp_secure: result.smtp_secure || false,
      smtp_user: result.smtp_user || '',
      smtp_pass: result.smtp_pass ? '••••••••' : '',
      smtp_from: result.smtp_from || '',
      has_password: !!result.smtp_pass,
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testSmtpConnection(@Body() dto: TestSmtpDto) {
    try {
      await this.emailService.testConnection();
      if (dto.email) {
        await this.emailService.sendTestEmail(dto.email);
        return {
          success: true,
          message: `Test email sent to ${dto.email}.`,
        };
      }
      return {
        success: true,
        message: 'SMTP connection verified successfully.',
      };
    } catch (error) {
      return {
        success: false,
        message: formatSmtpError(error),
      };
    }
  }
}
