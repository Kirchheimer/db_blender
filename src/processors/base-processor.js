import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import config from '../utils/config.js';

export class BaseProcessor {
  constructor() {
    this.config = config.getConfig();
  }

  /**
   * Process a file and generate the output
   * @param {string} filePath - Path to the input file
   * @returns {Promise<void>}
   */
  async process(filePath) {
    throw new Error('process() method must be implemented by processor');
  }

  /**
   * Generate output filename based on input filename and configuration
   * @param {string} inputPath - Original input file path
   * @param {string} [extension] - Optional extension override
   * @returns {string} - Path to the output file
   */
  generateOutputPath(inputPath, extension) {
    const originalName = path.basename(inputPath, path.extname(inputPath));
    const outputExt = extension || this.getOutputExtension();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(
      this.config.exportDir,
      `${originalName}_converted_${timestamp}${outputExt}`
    );
  }

  /**
   * Get the appropriate file extension based on output format
   * @returns {string} - File extension including the dot
   */
  getOutputExtension() {
    const format = this.config.outputFormat;
    switch (format) {
      case 'mysql':
      case 'postgresql':
        return '.sql';
      case 'csv':
        return '.csv';
      case 'json':
        return '.json';
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }

  /**
   * Read the content of a file
   * @param {string} filePath - Path to the file to read
   * @returns {Promise<string>} - File content
   */
  async readFile(filePath) {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      logger.error(`Error reading file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Write content to output file
   * @param {string} outputPath - Path to write the file to
   * @param {string} content - Content to write
   * @returns {Promise<void>}
   */
  async writeFile(outputPath, content) {
    try {
      await fs.writeFile(outputPath, content, 'utf8');
      logger.info(`Successfully wrote output to ${outputPath}`);
    } catch (error) {
      logger.error(`Error writing file ${outputPath}:`, error);
      throw error;
    }
  }

  /**
   * Validate that the file exists and is readable
   * @param {string} filePath - Path to the file to validate
   * @returns {Promise<void>}
   */
  async validateFile(filePath) {
    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch (error) {
      logger.error(`File ${filePath} is not accessible:`, error);
      throw new Error(`File ${filePath} is not accessible`);
    }
  }
}
