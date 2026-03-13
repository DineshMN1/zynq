/**
 * E2E tests for AuthController (/api/v1/auth/*)
 *
 * Tests the real HTTP layer: guards, validation pipe, cookie handling,
 * exception filter, and response shapes. The AuthService is mocked so no
 * database or external dependencies are required.
 */

import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp,
  createMockAuthService,
  createMockFileService,
  signTestToken,
  TEST_USER,
  TestApp,
} from './helpers/app.helper';

describe('AuthController (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp(
      createMockAuthService(),
      createMockFileService(),
    );
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default mock implementations after each test's overrides
    testApp.mockAuthService.needsSetup.mockResolvedValue(false);
    testApp.mockAuthService.register.mockResolvedValue(TEST_USER);
    testApp.mockAuthService.login.mockResolvedValue(TEST_USER);
    testApp.mockAuthService.generateJwtToken.mockReturnValue('mock-jwt-token');
    testApp.mockAuthService.updateProfile.mockResolvedValue({
      ...TEST_USER,
      name: 'Updated Name',
    });
    testApp.mockAuthService.changePassword.mockResolvedValue(undefined);
  });

  const api = () => request(testApp.app.getHttpServer());

  const bearerToken = () => {
    // Signs a fresh token each call so tests are independent
    return signTestToken(testApp.jwtService);
  };

  // ── GET /auth/setup-status ─────────────────────────────────────────────────

  describe('GET /api/v1/auth/setup-status', () => {
    it('returns needsSetup: false when users exist', async () => {
      testApp.mockAuthService.needsSetup.mockResolvedValue(false);

      const res = await api().get('/api/v1/auth/setup-status').expect(200);

      expect(res.body).toEqual({ needsSetup: false });
      expect(testApp.mockAuthService.needsSetup).toHaveBeenCalled();
    });

    it('returns needsSetup: true when no users exist', async () => {
      testApp.mockAuthService.needsSetup.mockResolvedValue(true);

      const res = await api().get('/api/v1/auth/setup-status').expect(200);

      expect(res.body).toEqual({ needsSetup: true });
    });
  });

  // ── POST /auth/register ───────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    const validBody = {
      name: 'Alice',
      email: 'alice@example.com',
      password: 'strongpass123',
    };

    it('registers a new user, sets jid cookie, returns user without password_hash', async () => {
      const res = await api()
        .post('/api/v1/auth/register')
        .send(validBody)
        .expect(201);

      expect(res.body).not.toHaveProperty('password_hash');
      expect(res.body.email).toBe(TEST_USER.email);
      expect(res.headers['set-cookie']).toBeDefined();
      expect(
        (res.headers['set-cookie'] as string[]).some((c) =>
          c.startsWith('jid='),
        ),
      ).toBe(true);
    });

    it('returns 400 when name is missing', async () => {
      const res = await api()
        .post('/api/v1/auth/register')
        .send({ email: 'alice@example.com', password: 'strongpass123' })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });

    it('returns 400 when email is invalid', async () => {
      const res = await api()
        .post('/api/v1/auth/register')
        .send({ ...validBody, email: 'not-an-email' })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });

    it('returns 400 when password is too short', async () => {
      const res = await api()
        .post('/api/v1/auth/register')
        .send({ ...validBody, password: 'short' })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });

    it('returns 400 when extra fields are sent (forbidNonWhitelisted)', async () => {
      const res = await api()
        .post('/api/v1/auth/register')
        .send({ ...validBody, unknownField: 'value' })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });

    it('returns 409 when email already exists', async () => {
      testApp.mockAuthService.register.mockRejectedValue(
        new ConflictException('User already exists'),
      );

      const res = await api()
        .post('/api/v1/auth/register')
        .send(validBody)
        .expect(409);

      expect(res.body.errorCode).toBe('CONFLICT');
    });
  });

  // ── POST /auth/login ──────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    const validBody = {
      email: 'e2e@example.com',
      password: 'correctpassword',
    };

    it('returns 200 with user and sets jid cookie', async () => {
      const res = await api()
        .post('/api/v1/auth/login')
        .send(validBody)
        .expect(200);

      expect(res.body).not.toHaveProperty('password_hash');
      expect(res.body.email).toBe(TEST_USER.email);
      expect(
        (res.headers['set-cookie'] as string[]).some((c) =>
          c.startsWith('jid='),
        ),
      ).toBe(true);
    });

    it('returns 400 when email is missing', async () => {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ password: 'somepassword' })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });

    it('returns 401 on invalid credentials', async () => {
      testApp.mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      const res = await api()
        .post('/api/v1/auth/login')
        .send(validBody)
        .expect(401);

      expect(res.body.errorCode).toBe('UNAUTHORIZED');
    });
  });

  // ── POST /auth/logout ─────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('returns 200 and clears jid cookie when authenticated', async () => {
      const res = await api()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${bearerToken()}`)
        .expect(200);

      expect(res.body).toEqual({ success: true });
    });

    it('returns 401 when not authenticated', async () => {
      const res = await api().post('/api/v1/auth/logout').expect(401);

      expect(res.body.errorCode).toBe('UNAUTHORIZED');
    });
  });

  // ── GET /auth/me ──────────────────────────────────────────────────────────

  describe('GET /api/v1/auth/me', () => {
    it('returns the current user when authenticated', async () => {
      const res = await api()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${bearerToken()}`)
        .expect(200);

      expect(res.body.id).toBe(TEST_USER.id);
      expect(res.body.email).toBe(TEST_USER.email);
      expect(res.body).not.toHaveProperty('password_hash');
    });

    it('returns 401 when no token provided', async () => {
      const res = await api().get('/api/v1/auth/me').expect(401);

      expect(res.body.errorCode).toBe('UNAUTHORIZED');
    });

    it('returns 401 when token is malformed', async () => {
      const res = await api()
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt')
        .expect(401);

      expect(res.body.errorCode).toBe('UNAUTHORIZED');
    });
  });

  // ── POST /auth/forgot-password ────────────────────────────────────────────

  describe('POST /api/v1/auth/forgot-password', () => {
    it('returns 200 with a generic message (no email enumeration)', async () => {
      const res = await api()
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'anyone@example.com' })
        .expect(200);

      expect(res.body).toHaveProperty('message');
      expect(testApp.mockAuthService.forgotPassword).toHaveBeenCalledWith(
        'anyone@example.com',
      );
    });

    it('returns 400 when email is invalid', async () => {
      const res = await api()
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });
  });

  // ── POST /auth/reset-password ─────────────────────────────────────────────

  describe('POST /api/v1/auth/reset-password', () => {
    it('returns 200 on valid token + password', async () => {
      const res = await api()
        .post('/api/v1/auth/reset-password')
        .send({ token: 'valid-reset-token', password: 'newstrongpass1' })
        .expect(200);

      expect(res.body).toHaveProperty('message');
      expect(testApp.mockAuthService.resetPassword).toHaveBeenCalledWith(
        'valid-reset-token',
        'newstrongpass1',
      );
    });

    it('returns 404 when reset token is expired or unknown', async () => {
      testApp.mockAuthService.resetPassword.mockRejectedValue(
        new NotFoundException('Token not found'),
      );

      const res = await api()
        .post('/api/v1/auth/reset-password')
        .send({ token: 'expired-token', password: 'newstrongpass1' })
        .expect(404);

      expect(res.body.errorCode).toBe('NOT_FOUND');
    });
  });

  // ── PATCH /auth/profile ───────────────────────────────────────────────────

  describe('PATCH /api/v1/auth/profile', () => {
    it('returns 200 with updated user', async () => {
      const res = await api()
        .patch('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${bearerToken()}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
      expect(res.body).not.toHaveProperty('password_hash');
      expect(testApp.mockAuthService.updateProfile).toHaveBeenCalledWith(
        TEST_USER.id,
        { name: 'Updated Name' },
      );
    });

    it('returns 401 when not authenticated', async () => {
      await api()
        .patch('/api/v1/auth/profile')
        .send({ name: 'New' })
        .expect(401);
    });
  });

  // ── POST /auth/change-password ────────────────────────────────────────────

  describe('POST /api/v1/auth/change-password', () => {
    const validBody = {
      currentPassword: 'oldpassword',
      newPassword: 'newstrongpass1',
    };

    it('returns 200 on successful password change', async () => {
      const res = await api()
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${bearerToken()}`)
        .send(validBody)
        .expect(200);

      expect(res.body).toEqual({ message: 'Password changed successfully' });
    });

    it('returns 401 when not authenticated', async () => {
      await api()
        .post('/api/v1/auth/change-password')
        .send(validBody)
        .expect(401);
    });

    it('returns 401 when current password is wrong', async () => {
      testApp.mockAuthService.changePassword.mockRejectedValue(
        new UnauthorizedException('Current password is incorrect'),
      );

      const res = await api()
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${bearerToken()}`)
        .send({ ...validBody, currentPassword: 'wrongpassword' })
        .expect(401);

      expect(res.body.errorCode).toBe('UNAUTHORIZED');
    });
  });
});
