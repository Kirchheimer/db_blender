# DB Blender - A rapid code experiment. 

A Docker-based tool for converting and modernizing database dumps between different formats and encodings.

## Features

- 🐳 Runs in Docker: No local DB dependencies
- 📁 Monitors Input Folder: Watches `/input` for SQL, CSV, JSON files
- 🔄 Processes Encoding & Schema: Converts between different encodings (e.g., latin1_general_ci ↔ utf8mb4_unicode_ci)
- 🔗 Handles Dependencies: Ensures foreign keys, indexes, and references remain valid
- 📦 Merges SQL Files: Combines multiple .sql table dumps into a single file
- ✨ Renames Tables: Allows stripping prefixes from table names
- 📤 Outputs to Export Folder: Saves converted files in `/export`

## Supported Formats

### Input
- MySQL Dump (.sql)
- AWS RDS Snapshot
- CSV
- JSON

### Output
- MySQL Dump (.sql)
- PostgreSQL Dump (.sql)
- CSV
- JSON

## Quick Start

1. Pull and run the container:
   ```bash
   docker run -v $(pwd)/input:/input -v $(pwd)/export:/export db-blender
   ```

2. Place your database files in the `input` directory

3. Converted files will appear in the `export` directory

## Usage

### Basic Usage

```bash
# Run with default settings
docker run -v $(pwd)/input:/input -v $(pwd)/export:/export db-blender

# Run with specific encoding conversion
docker run -v $(pwd)/input:/input -v $(pwd)/export:/export db-blender --from-encoding latin1 --to-encoding utf8mb4

# Strip table prefixes
docker run -v $(pwd)/input:/input -v $(pwd)/export:/export db-blender --strip-prefix old_prefix_
```

### Configuration Options

- `--from-encoding`: Source encoding (default: auto-detect)
- `--to-encoding`: Target encoding (default: utf8mb4)
- `--strip-prefix`: Table prefix to remove
- `--merge-sql`: Merge multiple SQL dumps into one file
- `--output-format`: Desired output format (mysql, postgresql, csv, json)

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Encoding mismatch | Uses iconv-lite to convert between different encodings |
| Foreign key errors | Processes dependencies before table creation |
| Deprecated types | Replaces old MySQL types with modern equivalents |
| Auto-increment resets | Ensures primary keys retain sequence values |
| CSV to SQL mismatches | Standardizes column types and names |
| Multiple SQL dumps | Merges into one structured file |
| Table name prefixes | Strips or replaces prefixes automatically |

## Development

### Prerequisites

- Docker
- Node.js (for development)

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/db-blender.git
cd db-blender

# Install dependencies
npm install

# Build Docker image
docker build -t db-blender .
```

### Running Tests

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
