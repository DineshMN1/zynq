import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: HealthCheckResult;
    storage: HealthCheckResult;
    memory: MemoryCheck;
  };
}

interface HealthCheckResult {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}

interface MemoryCheck {
  status: 'up' | 'down';
  heapUsed: string;
  heapTotal: string;
  external: string;
  rss: string;
}

@Controller('health')
export class HealthController {
  private s3Client: S3Client;
  private bucket: string;
  private startTime: number;

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    this.startTime = Date.now();
    this.bucket = this.configService.get('S3_BUCKET') || 'zynq-cloud';
    this.s3Client = new S3Client({
      endpoint: this.configService.get('S3_ENDPOINT'),
      region: this.configService.get('S3_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get('S3_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get('S3_SECRET_ACCESS_KEY') || '',
      },
      forcePathStyle: this.configService.get('S3_FORCE_PATH_STYLE') === 'true',
    });
  }

  @Get()
  async check(): Promise<HealthCheck> {
    const [database, storage, memory] = await Promise.all([
      this.checkDatabase(),
      this.checkStorage(),
      this.checkMemory(),
    ]);

    const isHealthy =
      database.status === 'up' &&
      storage.status === 'up' &&
      memory.status === 'up';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database,
        storage,
        memory,
      },
    };
  }

  @Get('live')
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness(): Promise<{ status: string; ready: boolean }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', ready: true };
    } catch {
      return { status: 'error', ready: false };
    }
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkStorage(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Storage connection failed',
      };
    }
  }

  private checkMemory(): MemoryCheck {
    const memUsage = process.memoryUsage();
    const formatBytes = (bytes: number) => {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(2)} MB`;
    };

    // Consider unhealthy if heap used > 90% of heap total
    const heapUsedRatio = memUsage.heapUsed / memUsage.heapTotal;
    const status = heapUsedRatio < 0.9 ? 'up' : 'down';

    return {
      status,
      heapUsed: formatBytes(memUsage.heapUsed),
      heapTotal: formatBytes(memUsage.heapTotal),
      external: formatBytes(memUsage.external),
      rss: formatBytes(memUsage.rss),
    };
  }
}
