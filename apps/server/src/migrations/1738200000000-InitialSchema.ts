import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1738200000000 implements MigrationInterface {
  name = 'InitialSchema1738200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        storage_used BIGINT DEFAULT 0,
        storage_limit BIGINT DEFAULT 10737418240,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT NOT NULL,
        token UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
        role TEXT DEFAULT 'user',
        inviter_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        name TEXT NOT NULL,
        mime_type TEXT,
        size BIGINT DEFAULT 0,
        storage_path TEXT,
        parent_id UUID REFERENCES files(id) ON DELETE CASCADE,
        is_folder BOOLEAN DEFAULT false,
        file_hash VARCHAR,
        encrypted_dek BYTEA,
        encryption_iv BYTEA,
        encryption_algo TEXT DEFAULT 'AES-256-GCM',
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        file_id UUID REFERENCES files(id) ON DELETE CASCADE NOT NULL,
        grantee_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        grantee_email TEXT,
        permission TEXT DEFAULT 'read',
        created_by UUID REFERENCES users(id) ON DELETE CASCADE,
        is_public BOOLEAN DEFAULT false,
        share_token TEXT UNIQUE,
        expires_at TIMESTAMPTZ,
        password TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        token VARCHAR UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_files_owner_id ON files(owner_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_files_parent_id ON files(parent_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_files_file_hash ON files(file_hash) WHERE file_hash IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_shares_file_id ON shares(file_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_shares_grantee_user_id ON shares(grantee_user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_shares_share_token ON shares(share_token)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_settings_user_id_key ON settings(user_id, key)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS password_resets`);
    await queryRunner.query(`DROP TABLE IF EXISTS settings`);
    await queryRunner.query(`DROP TABLE IF EXISTS shares`);
    await queryRunner.query(`DROP TABLE IF EXISTS files`);
    await queryRunner.query(`DROP TABLE IF EXISTS invitations`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
