import { BaseProcessor } from './base-processor.js';
import logger from '../utils/logger.js';
import iconv from 'iconv-lite';
import { Parser } from 'node-sql-parser';

export class SqlProcessor extends BaseProcessor {
  constructor() {
    super();
    this.parser = new Parser();
    this.tables = new Map(); // Store table definitions
    this.dependencies = new Map(); // Store table dependencies
  }

  async process(filePath) {
    try {
      await this.validateFile(filePath);
      logger.info(`Processing SQL file: ${filePath}`);

      // Read and decode the file content
      let content = await this.readFile(filePath);
      content = await this.convertEncoding(content);

      // Parse and transform the SQL
      const statements = this.splitStatements(content);
      const transformedStatements = await this.transformStatements(statements);

      // Generate the output
      const outputPath = this.generateOutputPath(filePath);
      const outputContent = this.generateOutput(transformedStatements);
      await this.writeFile(outputPath, outputContent);

    } catch (error) {
      logger.error('Error processing SQL file:', error);
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
   * Split SQL content into individual statements
   */
  splitStatements(content) {
    const statements = [];
    let currentStatement = '';
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('--') || trimmedLine.startsWith('#') || !trimmedLine) {
        continue;
      }

      currentStatement += line + '\n';

      if (trimmedLine.endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }

    return statements;
  }

  /**
   * Transform SQL statements according to configuration
   */
  async transformStatements(statements) {
    const transformed = [];

    for (const statement of statements) {
      try {
        // Parse the statement
        const ast = this.parser.astify(statement);

        if (ast.type === 'create') {
          // Handle CREATE TABLE statements
          const tableName = ast.table[0].table;
          
          // Strip prefix if configured
          if (this.config.stripPrefix && tableName.startsWith(this.config.stripPrefix)) {
            ast.table[0].table = tableName.substring(this.config.stripPrefix.length);
          }

          // Transform column definitions
          if (ast.create_definitions) {
            ast.create_definitions = this.transformColumns(ast.create_definitions);
          }

          // Store table definition for dependency resolution
          this.tables.set(tableName, ast);
          
          // Extract foreign key dependencies
          this.extractDependencies(tableName, ast);
        }

        // Convert back to SQL
        const transformedSql = this.parser.sqlify(ast);
        transformed.push(transformedSql);

      } catch (error) {
        logger.warn(`Error transforming statement, keeping original: ${error.message}`);
        transformed.push(statement);
      }
    }

    return this.config.mergeSql ? this.orderByDependencies(transformed) : transformed;
  }

  /**
   * Transform column definitions to use modern types and encoding
   */
  transformColumns(columns) {
    return columns.map(column => {
      // Convert deprecated types
      if (column.type === 'TINYTEXT') {
        column.type = 'VARCHAR';
        column.length = 255;
      }

      // Set modern character set and collation
      if (column.type === 'VARCHAR' || column.type === 'TEXT') {
        column.charset = this.config.toEncoding;
        column.collate = `${this.config.toEncoding}_unicode_ci`;
      }

      return column;
    });
  }

  /**
   * Extract table dependencies from foreign key constraints
   */
  extractDependencies(tableName, ast) {
    const dependencies = new Set();

    if (ast.create_definitions) {
      for (const def of ast.create_definitions) {
        if (def.resource === 'foreign key') {
          dependencies.add(def.reference_definition.table);
        }
      }
    }

    this.dependencies.set(tableName, dependencies);
  }

  /**
   * Order statements by dependencies for proper table creation
   */
  orderByDependencies(statements) {
    const ordered = [];
    const visited = new Set();

    const visit = (tableName) => {
      if (visited.has(tableName)) return;
      
      const deps = this.dependencies.get(tableName) || new Set();
      for (const dep of deps) {
        visit(dep);
      }

      visited.add(tableName);
      const stmt = statements.find(s => s.includes(`CREATE TABLE \`${tableName}\``));
      if (stmt) ordered.push(stmt);
    };

    // Visit all tables
    for (const tableName of this.tables.keys()) {
      visit(tableName);
    }

    // Add remaining statements (non-CREATE TABLE)
    statements.forEach(stmt => {
      if (!stmt.trim().toUpperCase().startsWith('CREATE TABLE')) {
        ordered.push(stmt);
      }
    });

    return ordered;
  }

  /**
   * Generate final output SQL
   */
  generateOutput(statements) {
    const header = [
      '-- Generated by DB Blender',
      `-- Timestamp: ${new Date().toISOString()}`,
      `-- Encoding: ${this.config.toEncoding}`,
      '',
      'SET NAMES utf8mb4;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      ''
    ].join('\n');

    const footer = [
      '',
      'SET FOREIGN_KEY_CHECKS = 1;'
    ].join('\n');

    return `${header}${statements.join(';\n\n')}${footer}`;
  }
}
