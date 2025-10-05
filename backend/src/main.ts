import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Cookie parser
  app.use(cookieParser());

  // CORS
  // CORS
const corsOrigins = (configService.get<string>('CORS_ORIGIN') || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
});


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

  console.log(`🚀 zynqCloud backend running on http://localhost:${port}`);
  console.log(`📡 API available at http://localhost:${port}/api/v1`);
}

bootstrap();