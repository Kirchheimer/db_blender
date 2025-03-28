import { BaseProcessor } from './base-processor.js';
import logger from '../utils/logger.js';
import iconv from 'iconv-lite';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { promisify } from 'util';

export class CsvProcessor extends BaseProcessor {
  constructor() {
    super();
    this.parseAsync = promisify(parse);
    this.stringifyAsync = promisify(stringify);
  }

  async process(filePath) {
    try {
      await this.validateFile(filePath);
      logger.info(`Processing CSV file: ${filePath}`);

      // Read and decode the file content
      let content = await this.readFile(filePath);
      content = await this.convertEncoding(content);

      // Parse CSV data
      const records = await this.parseAsync(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      // Infer column types
      const columnTypes = this.inferColumnTypes(records);
      logger.info('Inferred column types:', columnTypes);

      // Generate output based on format
      const outputPath = this.generateOutputPath(filePath);
      const outputContent = await this.generateOutput(records, columnTypes);
      await this.writeFile(outputPath, outputContent);

    } catch (error) {
      logger.error('Error processing CSV file:', error);
      throw error;
    }
  }

  /**
   * Convert file encoding if necessary
   */
  async convertEncoding(content) {
    if (this.config.fromEncoding === 'auto') {
      // TODO: Implement encoding detection
      return content;
    }

    if (this.config.fromEncoding !== this.config.toEncoding) {
      logger.info(`Converting encoding from ${this.config.fromEncoding} to ${this.config.toEncoding}`);
      const buffer = iconv.encode(content, this.config.fromEncoding);
      return iconv.decode(buffer, this.config.toEncoding);
    }

    return content;
  }

  /**
   * Infer SQL column types from CSV data
   */
  inferColumnTypes(records) {
    if (records.length === 0) {
      return {};
    }

    const columnTypes = {};
    const firstRow = records[0];

    // Initialize type tracking for each column
    for (const column of Object.keys(firstRow)) {
      columnTypes[column] = {
        type: null,
        maxLength: 0,
        containsDecimal: false,
        containsNonNumeric: false,
        isDate: true
      };
    }

    // Analyze each record
    for (const record of records) {
      for (const [column, value] of Object.entries(record)) {
        if (value === null || value === '') continue;

        const strValue = String(value);
        const numValue = Number(value);
        const tracking = columnTypes[column];

        // Update max length
        tracking.maxLength = Math.max(tracking.maxLength, strValue.length);

        // Check if it's a valid date
        const date = new Date(value);
        if (tracking.isDate && date.toString() === 'Invalid Date') {
          tracking.isDate = false;
        }

        // Check if it's numeric
        if (!Number.isNaN(numValue)) {
          if (String(numValue).includes('.')) {
            tracking.containsDecimal = true;
          }
        } else {
          tracking.containsNonNumeric = true;
        }
      }
    }

    // Determine final types
    for (const [column, tracking] of Object.entries(columnTypes)) {
      if (tracking.isDate) {
        tracking.type = 'DATETIME';
      } else if (!tracking.containsNonNumeric) {
        if (tracking.containsDecimal) {
          tracking.type = 'DECIMAL(10,2)';
        } else if (tracking.maxLength <= 3) {
          tracking.type = 'TINYINT';
        } else if (tracking.maxLength <= 5) {
          tracking.type = 'SMALLINT';
        } else if (tracking.maxLength <= 10) {
          tracking.type = 'INT';
        } else {
          tracking.type = 'BIGINT';
        }
      } else {
        if (tracking.maxLength <= 255) {
          tracking.type = 'VARCHAR(' + tracking.maxLength + ')';
        } else {
          tracking.type = 'TEXT';
        }
      }
    }

    return columnTypes;
  }

  /**
   * Generate output in the specified format
   */
  async generateOutput(records, columnTypes) {
    switch (this.config.outputFormat) {
      case 'mysql':
      case 'postgresql':
        return this.generateSqlOutput(records, columnTypes);
      case 'json':
        return JSON.stringify(records, null, 2);
      case 'csv':
        return this.stringifyAsync(records, {
          header: true,
          quoted: true
        });
      default:
        throw new Error(`Unsupported output format: ${this.config.outputFormat}`);
    }
  }

  /**
   * Generate SQL output from CSV data
   */
  generateSqlOutput(records, columnTypes) {
    if (records.length === 0) {
      return '';
    }

    const tableName = 'imported_data';
    const columns = Object.keys(records[0]);
    
    // Generate CREATE TABLE statement
    let sql = [
      '-- Generated by DB Blender',
      `-- Timestamp: ${new Date().toISOString()}`,
      `-- Encoding: ${this.config.toEncoding}`,
      '',
      'SET NAMES utf8mb4;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      '',
      `CREATE TABLE \`${tableName}\` (`
    ].join('\n');

    // Add column definitions
    const columnDefs = columns.map(column => {
      const type = columnTypes[column].type;
      return `  \`${column}\` ${type} CHARACTER SET ${this.config.toEncoding} COLLATE ${this.config.toEncoding}_unicode_ci`;
    });
    sql += columnDefs.join(',\n') + '\n);\n\n';

    // Generate INSERT statements
    const insertHeader = `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES\n`;
    const values = records.map(record => {
      const rowValues = columns.map(column => {
        const value = record[column];
        if (value === null || value === '') {
          return 'NULL';
        }
        return `'${String(value).replace(/'/g, "''")}'`;
      });
      return `(${rowValues.join(', ')})`;
    });

    sql += insertHeader + values.join(',\n') + ';\n\n';
    sql += 'SET FOREIGN_KEY_CHECKS = 1;\n';

    return sql;
  }
}
