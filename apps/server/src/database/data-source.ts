import 'reflect-metadata';
import { DataSource } from 'typeorm';

const port = parseInt(process.env.DATABASE_PORT || '5432', 10);

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port,
  username: process.env.DATABASE_USER || 'zynqcloud',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'zynqcloud',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: false,
});
