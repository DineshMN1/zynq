/**
 * E2E tests for FileController (/api/v1/files/*)
 *
 * Tests the real HTTP layer: JWT guard, validation pipe, routing, status codes,
 * and response shapes. FileService is mocked so no database or storage is
 * needed.
 *
 * Static routes (trash, shared, bulk, check-duplicate) are exercised before
 * parameterised :id routes — mirroring the controller's route ordering.
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp,
  createMockAuthService,
  createMockFileService,
  signTestToken,
  TEST_USER,
  TestApp,
} from './helpers/app.helper';

const FILE_ID = 'file-e2e-1';
const SHARE_ID = 'share-e2e-1';
const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('FileController (e2e)', () => {
  let testApp: TestApp;
  let authHeader: string;

  beforeAll(async () => {
    testApp = await createTestApp(
      createMockAuthService(),
      createMockFileService(),
    );
    authHeader = `Bearer ${signTestToken(testApp.jwtService)}`;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default mock return values after any per-test overrides
    testApp.mockFileService.findAll.mockResolvedValue({
      items: [
        {
          id: FILE_ID,
          owner_id: TEST_USER.id,
          name: 'test-folder',
          is_folder: true,
          publicShareCount: 0,
          privateShareCount: 0,
        },
      ],
      total: 1,
    });
    testApp.mockFileService.findById.mockResolvedValue({
      id: FILE_ID,
      owner_id: TEST_USER.id,
      name: 'test-folder',
      is_folder: true,
      mime_type: 'inode/directory',
      publicShareCount: 0,
      privateShareCount: 0,
    });
    testApp.mockFileService.create.mockResolvedValue({
      id: FILE_ID,
      name: 'new-folder',
      is_folder: true,
    });
    testApp.mockFileService.rename.mockResolvedValue({
      id: FILE_ID,
      name: 'renamed',
    });
    testApp.mockFileService.softDelete.mockResolvedValue(undefined);
    testApp.mockFileService.permanentDelete.mockResolvedValue(undefined);
    testApp.mockFileService.restore.mockResolvedValue({ id: FILE_ID });
    testApp.mockFileService.bulkSoftDelete.mockResolvedValue({
      deleted: 1,
      notFound: 0,
      forbidden: 0,
    });
    testApp.mockFileService.getTrashedFiles.mockResolvedValue({
      items: [],
      total: 0,
    });
    testApp.mockFileService.emptyTrash.mockResolvedValue(undefined);
    testApp.mockFileService.getSharedWithMe.mockResolvedValue({
      items: [],
      total: 0,
    });
    testApp.mockFileService.getPublicSharesByUser.mockResolvedValue([]);
    testApp.mockFileService.getPrivateSharesByUser.mockResolvedValue({
      items: [],
      total: 0,
    });
    testApp.mockFileService.checkDuplicate.mockResolvedValue({
      isDuplicate: false,
    });
    testApp.mockFileService.revokeShare.mockResolvedValue(undefined);
    testApp.mockFileService.updatePublicShareSettings.mockResolvedValue({
      id: SHARE_ID,
    });
    testApp.mockFileService.share.mockResolvedValue({
      id: SHARE_ID,
      token: 'share-token',
    });
  });

  const api = () => request(testApp.app.getHttpServer());

  // ── JWT guard ──────────────────────────────────────────────────────────────

  describe('JWT guard', () => {
    it('GET /files without token → 401', async () => {
      const res = await api().get('/api/v1/files').expect(401);
      expect(res.body.errorCode).toBe('UNAUTHORIZED');
    });

    it('GET /files with malformed token → 401', async () => {
      const res = await api()
        .get('/api/v1/files')
        .set('Authorization', 'Bearer bad.token')
        .expect(401);
      expect(res.body.errorCode).toBe('UNAUTHORIZED');
    });
  });

  // ── GET /files ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/files', () => {
    it('returns paginated file list', async () => {
      const res = await api()
        .get('/api/v1/files?page=1&limit=25')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(25);
      expect(res.body.meta.total).toBe(1);
      expect(testApp.mockFileService.findAll).toHaveBeenCalledWith(
        TEST_USER.id,
        1,
        25,
        undefined,
        undefined,
      );
    });

    it('defaults to page=1, limit=50', async () => {
      await api()
        .get('/api/v1/files')
        .set('Authorization', authHeader)
        .expect(200);

      expect(testApp.mockFileService.findAll).toHaveBeenCalledWith(
        TEST_USER.id,
        1,
        50,
        undefined,
        undefined,
      );
    });

    it('passes search and parentId query params', async () => {
      await api()
        .get('/api/v1/files?search=doc&parentId=parent-123')
        .set('Authorization', authHeader)
        .expect(200);

      expect(testApp.mockFileService.findAll).toHaveBeenCalledWith(
        TEST_USER.id,
        1,
        50,
        'doc',
        'parent-123',
      );
    });

    it('coerces publicShareCount/privateShareCount to 0 when missing', async () => {
      testApp.mockFileService.findAll.mockResolvedValue({
        items: [{ id: FILE_ID, name: 'file' }], // no share counts
        total: 1,
      });

      const res = await api()
        .get('/api/v1/files')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.items[0].publicShareCount).toBe(0);
      expect(res.body.items[0].privateShareCount).toBe(0);
    });
  });

  // ── POST /files ────────────────────────────────────────────────────────────

  describe('POST /api/v1/files', () => {
    const validFolder = {
      name: 'My Folder',
      size: 0,
      mimeType: 'inode/directory',
      isFolder: true,
    };

    it('creates a folder and returns 201', async () => {
      const res = await api()
        .post('/api/v1/files')
        .set('Authorization', authHeader)
        .send(validFolder)
        .expect(201);

      expect(res.body.is_folder).toBe(true);
      expect(testApp.mockFileService.create).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.objectContaining({ mimeType: 'inode/directory' }),
      );
    });

    it('returns 400 when name contains invalid characters', async () => {
      const res = await api()
        .post('/api/v1/files')
        .set('Authorization', authHeader)
        .send({ ...validFolder, name: 'bad/name' })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });

    it('returns 400 when mime type is not in the allowlist', async () => {
      const res = await api()
        .post('/api/v1/files')
        .set('Authorization', authHeader)
        .send({ ...validFolder, mimeType: 'application/x-msdownload' })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });

    it('returns 400 when size is missing', async () => {
      const res = await api()
        .post('/api/v1/files')
        .set('Authorization', authHeader)
        .send({ name: 'folder', mimeType: 'inode/directory' })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });
  });

  // ── GET /files/trash ───────────────────────────────────────────────────────

  describe('GET /api/v1/files/trash', () => {
    it('returns paginated trashed files', async () => {
      testApp.mockFileService.getTrashedFiles.mockResolvedValue({
        items: [{ id: 'trash-1', name: 'old-file.txt' }],
        total: 1,
      });

      const res = await api()
        .get('/api/v1/files/trash?page=2&limit=10')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.limit).toBe(10);
      expect(testApp.mockFileService.getTrashedFiles).toHaveBeenCalledWith(
        TEST_USER.id,
        2,
        10,
      );
    });
  });

  // ── DELETE /files/trash/empty ──────────────────────────────────────────────

  describe('DELETE /api/v1/files/trash/empty', () => {
    it('empties trash and returns 204', async () => {
      await api()
        .delete('/api/v1/files/trash/empty')
        .set('Authorization', authHeader)
        .expect(204);

      expect(testApp.mockFileService.emptyTrash).toHaveBeenCalledWith(
        TEST_USER.id,
      );
    });
  });

  // ── GET /files/shared ──────────────────────────────────────────────────────

  describe('GET /api/v1/files/shared', () => {
    it('returns paginated files shared with me', async () => {
      testApp.mockFileService.getSharedWithMe.mockResolvedValue({
        items: [{ id: 'shared-file-1' }],
        total: 1,
      });

      const res = await api()
        .get('/api/v1/files/shared?page=1&limit=20')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  // ── GET /files/public-shares ───────────────────────────────────────────────

  describe('GET /api/v1/files/public-shares', () => {
    it('returns list of public shares for the user', async () => {
      testApp.mockFileService.getPublicSharesByUser.mockResolvedValue([
        { id: SHARE_ID, token: 'tok' },
      ]);

      const res = await api()
        .get('/api/v1/files/public-shares')
        .set('Authorization', authHeader)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].id).toBe(SHARE_ID);
    });
  });

  // ── GET /files/private-shares ──────────────────────────────────────────────

  describe('GET /api/v1/files/private-shares', () => {
    it('returns paginated private shares', async () => {
      testApp.mockFileService.getPrivateSharesByUser.mockResolvedValue({
        items: [{ id: SHARE_ID }],
        total: 1,
      });

      const res = await api()
        .get('/api/v1/files/private-shares')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  // ── DELETE /files/bulk ─────────────────────────────────────────────────────

  describe('DELETE /api/v1/files/bulk', () => {
    it('soft-deletes multiple files and returns 200', async () => {
      const ids = [VALID_UUID, 'b2c3d4e5-f6a7-8901-bcde-f12345678901'];

      const res = await api()
        .delete('/api/v1/files/bulk')
        .set('Authorization', authHeader)
        .send({ ids })
        .expect(200);

      expect(testApp.mockFileService.bulkSoftDelete).toHaveBeenCalledWith(
        ids,
        TEST_USER.id,
      );
      expect(res.body).toHaveProperty('deleted');
    });

    it('returns 400 when ids array is empty', async () => {
      const res = await api()
        .delete('/api/v1/files/bulk')
        .set('Authorization', authHeader)
        .send({ ids: [] })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });

    it('returns 400 when ids contains non-UUIDs', async () => {
      const res = await api()
        .delete('/api/v1/files/bulk')
        .set('Authorization', authHeader)
        .send({ ids: ['not-a-uuid'] })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });
  });

  // ── POST /files/check-duplicate ────────────────────────────────────────────

  describe('POST /api/v1/files/check-duplicate', () => {
    it('returns isDuplicate: false when no duplicate', async () => {
      const res = await api()
        .post('/api/v1/files/check-duplicate')
        .set('Authorization', authHeader)
        .send({ fileHash: 'abc123', fileName: 'report.pdf' })
        .expect(201);

      expect(res.body).toEqual({ isDuplicate: false });
    });

    it('returns duplicate info when a matching file exists', async () => {
      testApp.mockFileService.checkDuplicate.mockResolvedValue({
        isDuplicate: true,
        existingFile: { id: FILE_ID, name: 'report.pdf' },
      });

      const res = await api()
        .post('/api/v1/files/check-duplicate')
        .set('Authorization', authHeader)
        .send({ fileHash: 'abc123' })
        .expect(201);

      expect(res.body.isDuplicate).toBe(true);
      expect(res.body.existingFile.id).toBe(FILE_ID);
    });
  });

  // ── DELETE /files/shares/:shareId ──────────────────────────────────────────

  describe('DELETE /api/v1/files/shares/:shareId', () => {
    it('revokes a share and returns 200 { success: true }', async () => {
      const res = await api()
        .delete(`/api/v1/files/shares/${SHARE_ID}`)
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body).toEqual({ success: true });
      expect(testApp.mockFileService.revokeShare).toHaveBeenCalledWith(
        SHARE_ID,
        TEST_USER.id,
      );
    });

    it('returns 404 when share does not exist', async () => {
      testApp.mockFileService.revokeShare.mockRejectedValue(
        new NotFoundException('Share not found'),
      );

      const res = await api()
        .delete(`/api/v1/files/shares/${SHARE_ID}`)
        .set('Authorization', authHeader)
        .expect(404);

      expect(res.body.errorCode).toBe('NOT_FOUND');
    });
  });

  // ── GET /files/:id ─────────────────────────────────────────────────────────

  describe('GET /api/v1/files/:id', () => {
    it('returns a single file', async () => {
      const res = await api()
        .get(`/api/v1/files/${FILE_ID}`)
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.id).toBe(FILE_ID);
      expect(testApp.mockFileService.findById).toHaveBeenCalledWith(
        FILE_ID,
        TEST_USER.id,
      );
    });

    it('returns 404 when file does not exist', async () => {
      testApp.mockFileService.findById.mockRejectedValue(
        new NotFoundException('File not found'),
      );

      const res = await api()
        .get(`/api/v1/files/no-such-file`)
        .set('Authorization', authHeader)
        .expect(404);

      expect(res.body.errorCode).toBe('NOT_FOUND');
    });
  });

  // ── PATCH /files/:id ───────────────────────────────────────────────────────

  describe('PATCH /api/v1/files/:id', () => {
    it('renames a file and returns 200', async () => {
      const res = await api()
        .patch(`/api/v1/files/${FILE_ID}`)
        .set('Authorization', authHeader)
        .send({ name: 'renamed-folder' })
        .expect(200);

      expect(res.body.name).toBe('renamed');
      expect(testApp.mockFileService.rename).toHaveBeenCalledWith(
        FILE_ID,
        TEST_USER.id,
        'renamed-folder',
      );
    });

    it('returns 403 when user does not own the file', async () => {
      testApp.mockFileService.rename.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      const res = await api()
        .patch(`/api/v1/files/${FILE_ID}`)
        .set('Authorization', authHeader)
        .send({ name: 'new-name' })
        .expect(403);

      expect(res.body.errorCode).toBe('FORBIDDEN');
    });
  });

  // ── DELETE /files/:id ──────────────────────────────────────────────────────

  describe('DELETE /api/v1/files/:id', () => {
    it('soft-deletes a file and returns 200 { success: true }', async () => {
      const res = await api()
        .delete(`/api/v1/files/${FILE_ID}`)
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body).toEqual({ success: true });
      expect(testApp.mockFileService.softDelete).toHaveBeenCalledWith(
        FILE_ID,
        TEST_USER.id,
      );
    });

    it('returns 404 when file not found', async () => {
      testApp.mockFileService.softDelete.mockRejectedValue(
        new NotFoundException('File not found'),
      );

      const res = await api()
        .delete(`/api/v1/files/${FILE_ID}`)
        .set('Authorization', authHeader)
        .expect(404);

      expect(res.body.errorCode).toBe('NOT_FOUND');
    });
  });

  // ── POST /files/:id/restore ────────────────────────────────────────────────

  describe('POST /api/v1/files/:id/restore', () => {
    it('restores a trashed file and returns 200', async () => {
      const res = await api()
        .post(`/api/v1/files/${FILE_ID}/restore`)
        .set('Authorization', authHeader)
        .expect(201);

      expect(res.body.id).toBe(FILE_ID);
      expect(testApp.mockFileService.restore).toHaveBeenCalledWith(
        FILE_ID,
        TEST_USER.id,
      );
    });

    it('returns 404 when file is not in trash', async () => {
      testApp.mockFileService.restore.mockRejectedValue(
        new NotFoundException('File not in trash'),
      );

      const res = await api()
        .post(`/api/v1/files/${FILE_ID}/restore`)
        .set('Authorization', authHeader)
        .expect(404);

      expect(res.body.errorCode).toBe('NOT_FOUND');
    });
  });

  // ── DELETE /files/:id/permanent ────────────────────────────────────────────

  describe('DELETE /api/v1/files/:id/permanent', () => {
    it('permanently deletes a file and returns 204', async () => {
      await api()
        .delete(`/api/v1/files/${FILE_ID}/permanent`)
        .set('Authorization', authHeader)
        .expect(204);

      expect(testApp.mockFileService.permanentDelete).toHaveBeenCalledWith(
        FILE_ID,
        TEST_USER.id,
      );
    });

    it('returns 404 when file not found', async () => {
      testApp.mockFileService.permanentDelete.mockRejectedValue(
        new NotFoundException('File not found'),
      );

      const res = await api()
        .delete(`/api/v1/files/${FILE_ID}/permanent`)
        .set('Authorization', authHeader)
        .expect(404);

      expect(res.body.errorCode).toBe('NOT_FOUND');
    });
  });

  // ── POST /files/:id/share ──────────────────────────────────────────────────

  describe('POST /api/v1/files/:id/share', () => {
    const validShareBody = {
      permission: 'read',
      isPublic: true,
    };

    it('creates a share and returns 201', async () => {
      const res = await api()
        .post(`/api/v1/files/${FILE_ID}/share`)
        .set('Authorization', authHeader)
        .send(validShareBody)
        .expect(201);

      expect(res.body.id).toBe(SHARE_ID);
      expect(testApp.mockFileService.share).toHaveBeenCalledWith(
        FILE_ID,
        TEST_USER.id,
        expect.objectContaining({ permission: 'read' }),
        undefined,
      );
    });

    it('returns 400 when permission is invalid', async () => {
      const res = await api()
        .post(`/api/v1/files/${FILE_ID}/share`)
        .set('Authorization', authHeader)
        .send({ permission: 'admin' })
        .expect(400);

      expect(res.body.errorCode).toBe('BAD_REQUEST');
    });

    it('returns 404 when file does not exist', async () => {
      testApp.mockFileService.share.mockRejectedValue(
        new NotFoundException('File not found'),
      );

      const res = await api()
        .post(`/api/v1/files/${FILE_ID}/share`)
        .set('Authorization', authHeader)
        .send(validShareBody)
        .expect(404);

      expect(res.body.errorCode).toBe('NOT_FOUND');
    });
  });
});
