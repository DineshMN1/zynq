import { Module } from '@nestjs/common';
// Import EE modules when implemented
// import { WorkspaceModule } from './workspace/workspace.module';
// import { TeamModule } from './team/team.module';
// import { AuditModule } from './audit/audit.module';
// import { SsoModule } from './sso/sso.module';
// import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    // WorkspaceModule,
    // TeamModule,
    // AuditModule,
    // SsoModule,
    // WebhookModule,
  ],
  exports: [],
})
export class EeModule {}
