import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEncryptionColumns1738500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add encrypted_dek column (stores IV + encrypted DEK)
    const hasEncryptedDek = await queryRunner.hasColumn(
      'files',
      'encrypted_dek',
    );
    if (!hasEncryptedDek) {
      await queryRunner.addColumn(
        'files',
        new TableColumn({
          name: 'encrypted_dek',
          type: 'bytea',
          isNullable: true,
        }),
      );
    }

    // Add encryption_iv column
    const hasEncryptionIv = await queryRunner.hasColumn(
      'files',
      'encryption_iv',
    );
    if (!hasEncryptionIv) {
      await queryRunner.addColumn(
        'files',
        new TableColumn({
          name: 'encryption_iv',
          type: 'bytea',
          isNullable: true,
        }),
      );
    }

    // Add encryption_algo column with default
    const hasEncryptionAlgo = await queryRunner.hasColumn(
      'files',
      'encryption_algo',
    );
    if (!hasEncryptionAlgo) {
      await queryRunner.addColumn(
        'files',
        new TableColumn({
          name: 'encryption_algo',
          type: 'varchar',
          length: '50',
          isNullable: true,
          default: "'AES-256-GCM'",
        }),
      );
    }

    // Ensure storage_quota column exists on users table with proper default (5GB)
    const hasStorageQuota = await queryRunner.hasColumn(
      'users',
      'storage_quota',
    );
    if (!hasStorageQuota) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'storage_quota',
          type: 'bigint',
          default: 5368709120, // 5GB
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasStorageQuota = await queryRunner.hasColumn(
      'users',
      'storage_quota',
    );
    if (hasStorageQuota) {
      await queryRunner.dropColumn('users', 'storage_quota');
    }

    const hasEncryptionAlgo = await queryRunner.hasColumn(
      'files',
      'encryption_algo',
    );
    if (hasEncryptionAlgo) {
      await queryRunner.dropColumn('files', 'encryption_algo');
    }

    const hasEncryptionIv = await queryRunner.hasColumn(
      'files',
      'encryption_iv',
    );
    if (hasEncryptionIv) {
      await queryRunner.dropColumn('files', 'encryption_iv');
    }

    const hasEncryptedDek = await queryRunner.hasColumn(
      'files',
      'encrypted_dek',
    );
    if (hasEncryptedDek) {
      await queryRunner.dropColumn('files', 'encrypted_dek');
    }
  }
}
