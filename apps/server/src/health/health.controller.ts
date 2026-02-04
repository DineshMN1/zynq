import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';

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
  private storagePath: string;
  private startTime: number;

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    this.startTime = Date.now();
    this.storagePath =
      this.configService.get('FILE_STORAGE_PATH') || '/data/files';
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
        error:
          error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkStorage(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Check if storage directory exists and is accessible
      await fs.access(this.storagePath);

      // Try to get stats to verify read access
      const stats = await fs.stat(this.storagePath);

      if (!stats.isDirectory()) {
        return {
          status: 'down',
          error: 'Storage path is not a directory',
        };
      }

      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        error:
          error instanceof Error ? error.message : 'Storage access failed',
      };
    }
  }

  private checkMemory(): MemoryCheck {
    const memUsage = process.memoryUsage();
    const formatBytes = (bytes: number) => {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(2)} MB`;
    };

    // Consider unhealthy if RSS > 500MB (reasonable limit for the app)
    const rssMB = memUsage.rss / 1024 / 1024;
    const status = rssMB < 500 ? 'up' : 'down';

    return {
      status,
      heapUsed: formatBytes(memUsage.heapUsed),
      heapTotal: formatBytes(memUsage.heapTotal),
      external: formatBytes(memUsage.external),
      rss: formatBytes(memUsage.rss),
    };
  }
}
