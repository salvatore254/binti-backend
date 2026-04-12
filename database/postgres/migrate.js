const { initializeConnection, closeConnection } = require('../connection');

const run = async () => {
  try {
    await initializeConnection();
    console.log('postgres-migrations-ok');
  } catch (error) {
    console.error('postgres-migrations-failed:', error.message);
    process.exitCode = 1;
  } finally {
    await closeConnection().catch(() => {});
  }
};

run();