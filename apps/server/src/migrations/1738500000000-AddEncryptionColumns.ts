import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEncryptionColumns1738500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add encrypted_dek column (stores IV + encrypted DEK)
    await queryRunner.addColumn(
      'files',
      new TableColumn({
        name: 'encrypted_dek',
        type: 'bytea',
        isNullable: true,
      }),
    );

    // Add encryption_iv column
    await queryRunner.addColumn(
      'files',
      new TableColumn({
        name: 'encryption_iv',
        type: 'bytea',
        isNullable: true,
      }),
    );

    // Add encryption_algo column with default
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
    await queryRunner.dropColumn('files', 'encryption_algo');
    await queryRunner.dropColumn('files', 'encryption_iv');
    await queryRunner.dropColumn('files', 'encrypted_dek');
  }
}
