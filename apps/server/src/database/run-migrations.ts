import dataSource from './data-source';

async function run() {
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}

run()
  .then(() => {
    console.log('Migrations completed successfully.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Migration failed:', error);
    try {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    } catch {
      // noop
    }
    process.exit(1);
  });
