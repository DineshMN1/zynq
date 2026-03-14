/**
 * E2E test app factory.
 *
 * Builds a real NestJS HTTP application with:
 *   - Real JWT signing/verification (test secret)
 *   - Real ValidationPipe, GlobalExceptionFilter, cookie-parser
 *   - Real JwtStrategy so 401 / 403 guard behaviour is exercised
 *   - All DB-touching services replaced with jest mocks
 *
 * Controllers under test:   AuthController, FileController
 * Services mocked:          AuthService, FileService, UserService (for JwtStrategy)
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import * as cookieParser from 'cookie-parser';

import { AuthController } from '../../src/core/auth/auth.controller';
import { FileController } from '../../src/core/file/controllers/file.controller';
import { JwtStrategy } from '../../src/core/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { GlobalExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { AuthService } from '../../src/core/auth/auth.service';
import { FileService } from '../../src/core/file/file.service';
import { UserService } from '../../src/core/user/user.service';
import { UserRole } from '../../src/core/user/entities/user.entity';

// ── Test constants ────────────────────────────────────────────────────────────

export const TEST_JWT_SECRET =
  'e2e-test-secret-that-is-at-least-32-characters-long!!';

export const TEST_USER = {
  id: 'user-e2e-1',
  name: 'E2E User',
  email: 'e2e@example.com',
  role: UserRole.OWNER,
  storage_used: 0,
  storage_limit: 10737418240,
  password_hash: '$2b$10$hashedpassword',
};

// ── Mock factories ────────────────────────────────────────────────────────────

export function createMockAuthService() {
  return {
    needsSetup: jest.fn().mockResolvedValue(false),
    register: jest.fn().mockResolvedValue(TEST_USER),
    login: jest.fn().mockResolvedValue(TEST_USER),
    generateJwtToken: jest.fn().mockReturnValue('mock-jwt-token'),
    forgotPassword: jest.fn().mockResolvedValue({
      message: 'If this email exists, a reset link was sent',
    }),
    resetPassword: jest
      .fn()
      .mockResolvedValue({ message: 'Password reset successfully' }),
    updateProfile: jest
      .fn()
      .mockResolvedValue({ ...TEST_USER, name: 'Updated Name' }),
    changePassword: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockFileService() {
  const mockFile = {
    id: 'file-e2e-1',
    owner_id: TEST_USER.id,
    name: 'test-folder',
    mime_type: 'inode/directory',
    size: 0,
    is_folder: true,
    storage_path: null,
    parent_id: null,
    file_hash: null,
    encrypted_dek: null,
    encryption_iv: null,
    encryption_algo: 'AES-256-GCM',
    deleted_at: null,
    publicShareCount: 0,
    privateShareCount: 0,
    shares: [],
  };

  return {
    findAll: jest.fn().mockResolvedValue({ items: [mockFile], total: 1 }),
    findById: jest.fn().mockResolvedValue(mockFile),
    create: jest.fn().mockResolvedValue(mockFile),
    rename: jest.fn().mockResolvedValue({ ...mockFile, name: 'renamed' }),
    softDelete: jest.fn().mockResolvedValue(undefined),
    permanentDelete: jest.fn().mockResolvedValue(undefined),
    restore: jest.fn().mockResolvedValue({ ...mockFile, deleted_at: null }),
    bulkSoftDelete: jest
      .fn()
      .mockResolvedValue({ deleted: 1, notFound: 0, forbidden: 0 }),
    uploadFileContentStream: jest
      .fn()
      .mockResolvedValue({ ...mockFile, size: 1024 }),
    downloadFile: jest.fn().mockResolvedValue(Buffer.from('file-content')),
    downloadSharedFile: jest.fn().mockResolvedValue(mockFile),
    getDecryptedFileContent: jest
      .fn()
      .mockResolvedValue(Buffer.from('content')),
    getFolderEntries: jest.fn().mockResolvedValue([]),
    getTrashedFiles: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    emptyTrash: jest.fn().mockResolvedValue(undefined),
    getSharedWithMe: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getPublicSharesByUser: jest.fn().mockResolvedValue([]),
    getPrivateSharesByUser: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0 }),
    share: jest.fn().mockResolvedValue({ id: 'share-1', token: 'share-token' }),
    revokeShare: jest.fn().mockResolvedValue(undefined),
    updatePublicShareSettings: jest
      .fn()
      .mockResolvedValue({ id: 'share-1', token: 'share-token' }),
    checkDuplicate: jest.fn().mockResolvedValue({ isDuplicate: false }),
  };
}

// ── App factory ───────────────────────────────────────────────────────────────

export interface TestApp {
  app: INestApplication;
  jwtService: JwtService;
  mockAuthService: ReturnType<typeof createMockAuthService>;
  mockFileService: ReturnType<typeof createMockFileService>;
}

/**
 * Creates a fully initialised NestJS E2E application.
 * Pass pre-created mock services so individual test suites can configure
 * return values before the app boots.
 */
export async function createTestApp(
  mockAuthService: ReturnType<typeof createMockAuthService>,
  mockFileService: ReturnType<typeof createMockFileService>,
): Promise<TestApp> {
  // JwtStrategy.validate() calls UserService.findById — provide a stub.
  const mockUserService = {
    findById: jest.fn().mockResolvedValue(TEST_USER),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [
      // Config — test values only, no .env file
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            JWT_SECRET: TEST_JWT_SECRET,
            NODE_ENV: 'test',
            COOKIE_DOMAIN: undefined,
            CORS_ORIGIN: '',
            FRONTEND_URL: '',
          }),
        ],
      }),
      // Real passport + JWT so guard behaviour is tested
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({
        secret: TEST_JWT_SECRET,
        signOptions: { expiresIn: '1d' },
      }),
      // ThrottlerModule present but very permissive — no APP_GUARD registered
      ThrottlerModule.forRoot([{ ttl: 60000, limit: 10000 }]),
    ],
    controllers: [AuthController, FileController],
    providers: [
      // Real strategy so JWT guard actually validates tokens
      JwtStrategy,
      JwtAuthGuard,
      // Mocked services — providers keyed by class so NestJS DI resolves them
      { provide: AuthService, useValue: mockAuthService },
      { provide: FileService, useValue: mockFileService },
      { provide: UserService, useValue: mockUserService },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();

  // Replicate the global setup from main.ts
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();

  const jwtService = moduleRef.get(JwtService);

  return { app, jwtService, mockAuthService, mockFileService };
}

/**
 * Signs a JWT for TEST_USER. Use the returned string as a Bearer token.
 */
export function signTestToken(jwtService: JwtService, overrides = {}): string {
  return jwtService.sign({
    sub: TEST_USER.id,
    email: TEST_USER.email,
    role: TEST_USER.role,
    ...overrides,
  });
}
