import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Cookie parser
  app.use(cookieParser());

  // CORS — allow all origins (self-hosted; no domain restrictions)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = configService.get('PORT') || 4000;
  await app.listen(port);

  logger.log(`zynqCloud backend running on http://localhost:${port}`);
  logger.log(`API available at http://localhost:${port}/api/v1`);
  logger.log(`Health check at http://localhost:${port}/api/v1/health`);
}

bootstrap();
