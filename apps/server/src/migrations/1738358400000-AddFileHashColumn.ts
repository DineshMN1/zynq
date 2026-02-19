import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFileHashColumn1738358400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasFileHash = await queryRunner.hasColumn('files', 'file_hash');
    if (!hasFileHash) {
      await queryRunner.addColumn(
        'files',
        new TableColumn({
          name: 'file_hash',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }

    // Add index for faster duplicate lookups
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_files_file_hash" ON "files" ("file_hash") WHERE "file_hash" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_files_file_hash"`);
    const hasFileHash = await queryRunner.hasColumn('files', 'file_hash');
    if (hasFileHash) {
      await queryRunner.dropColumn('files', 'file_hash');
    }
  }
}
