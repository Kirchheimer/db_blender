import logger from './utils/logger.js';
import config from './utils/config.js';
import watcher from './watcher.js';
import { SqlProcessor } from './processors/sql-processor.js';
import { CsvProcessor } from './processors/csv-processor.js';
import { JsonProcessor } from './processors/json-processor.js';

async function main() {
  try {
    // Load configuration
    const cfg = config.getConfig();
    logger.info('DB Blender starting...');
    logger.info(`Input directory: ${cfg.inputDir}`);
    logger.info(`Export directory: ${cfg.exportDir}`);
    logger.info(`Output format: ${cfg.outputFormat}`);

    // Initialize processors
    const sqlProcessor = new SqlProcessor();
    const csvProcessor = new CsvProcessor();
    const jsonProcessor = new JsonProcessor();

    // Register processors
    watcher.registerProcessor('.sql', sqlProcessor);
    watcher.registerProcessor('.csv', csvProcessor);
    watcher.registerProcessor('.json', jsonProcessor);

    // Start the file watcher
    await watcher.start();
    logger.info('DB Blender is ready for file processing');

  } catch (error) {
    logger.error('Failed to start DB Blender:', error);
    process.exit(1);
  }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal. Shutting down...');
  await watcher.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal. Shutting down...');
  await watcher.stop();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main();
