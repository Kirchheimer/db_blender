import { Command } from 'commander';
import logger from './logger.js';

class Config {
  constructor() {
    this.program = new Command();
    this.setupCommandLine();
    this.options = {};
  }

  setupCommandLine() {
    this.program
      .name('db-blender')
      .description('Database conversion and modernization tool')
      .version('1.0.0')
      .option('--from-encoding <encoding>', 'Source encoding', 'auto')
      .option('--to-encoding <encoding>', 'Target encoding', 'utf8mb4')
      .option('--strip-prefix <prefix>', 'Table prefix to remove')
      .option('--merge-sql', 'Merge multiple SQL dumps into one file', false)
      .option(
        '--output-format <format>',
        'Output format (mysql, postgresql, csv, json)',
        'mysql'
      );

    this.program.parse();
  }

  getConfig() {
    if (!this.options.parsed) {
      try {
        this.options = {
          fromEncoding: this.program.opts().fromEncoding,
          toEncoding: this.program.opts().toEncoding,
          stripPrefix: this.program.opts().stripPrefix,
          mergeSql: this.program.opts().mergeSql,
          outputFormat: this.program.opts().outputFormat,
          inputDir: '/input',
          exportDir: '/export',
          parsed: true
        };

        // Validate output format
        const validFormats = ['mysql', 'postgresql', 'csv', 'json'];
        if (!validFormats.includes(this.options.outputFormat)) {
          throw new Error(`Invalid output format. Must be one of: ${validFormats.join(', ')}`);
        }

        logger.info('Configuration loaded successfully');
        logger.debug('Current configuration:', this.options);
      } catch (error) {
        logger.error('Error parsing configuration:', error);
        process.exit(1);
      }
    }

    return this.options;
  }
}

export default new Config();
