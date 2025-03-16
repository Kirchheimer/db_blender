import chokidar from 'chokidar';
import path from 'path';
import logger from './utils/logger.js';
import config from './utils/config.js';

class FileWatcher {
  constructor() {
    this.config = config.getConfig();
    this.watcher = null;
    this.processors = new Map();
  }

  registerProcessor(extension, processor) {
    this.processors.set(extension.toLowerCase(), processor);
    logger.info(`Registered processor for ${extension} files`);
  }

  async handleFile(filePath) {
    try {
      const extension = path.extname(filePath).toLowerCase();
      const processor = this.processors.get(extension);

      if (!processor) {
        logger.warn(`No processor registered for ${extension} files. Skipping ${filePath}`);
        return;
      }

      logger.info(`Processing file: ${filePath}`);
      await processor.process(filePath);
      logger.info(`Successfully processed file: ${filePath}`);
    } catch (error) {
      logger.error(`Error processing file ${filePath}:`, error);
    }
  }

  async start() {
    try {
      logger.info(`Starting file watcher on ${this.config.inputDir}`);

      this.watcher = chokidar.watch(this.config.inputDir, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });

      this.watcher
        .on('add', async (filePath) => {
          logger.info(`New file detected: ${filePath}`);
          await this.handleFile(filePath);
        })
        .on('change', async (filePath) => {
          logger.info(`File changed: ${filePath}`);
          await this.handleFile(filePath);
        })
        .on('unlink', (filePath) => {
          logger.info(`File removed: ${filePath}`);
        })
        .on('error', (error) => {
          logger.error('Watcher error:', error);
        });

      logger.info('File watcher started successfully');
    } catch (error) {
      logger.error('Error starting file watcher:', error);
      throw error;
    }
  }

  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      logger.info('File watcher stopped');
    }
  }
}

export default new FileWatcher();
