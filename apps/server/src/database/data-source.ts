import 'reflect-metadata';
import { DataSource } from 'typeorm';

const port = parseInt(process.env.DATABASE_PORT || '5432', 10);
if (Number.isNaN(port)) {
  throw new Error(
    `Invalid DATABASE_PORT value: ${process.env.DATABASE_PORT || '(empty)'}`,
  );
}

const databasePassword = process.env.DATABASE_PASSWORD;
if (!databasePassword) {
  throw new Error('DATABASE_PASSWORD is required');
}

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port,
  username: process.env.DATABASE_USER || 'zynqcloud',
  password: databasePassword,
  database: process.env.DATABASE_NAME || 'zynqcloud',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: false,
});
