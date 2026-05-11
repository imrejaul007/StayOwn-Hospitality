import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, relative } from 'path';

/**
 * FileScanner - Recursively scans directories and reads files for analysis.
 * Provides filtered file lists and content access.
 */
export class FileScanner {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.cache = new Map();
  }

  async scanDirectory(dir, options = {}) {
    const {
      extensions = ['.js', '.ts', '.tsx', '.jsx', '.json'],
      ignore = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next'],
      maxDepth = 15,
    } = options;

    const results = [];
    await this._walk(dir, results, extensions, ignore, 0, maxDepth);
    return results;
  }

  async _walk(dir, results, extensions, ignore, depth, maxDepth) {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!ignore.includes(entry.name)) {
          await this._walk(fullPath, results, extensions, ignore, depth + 1, maxDepth);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (extensions.includes(ext)) {
          results.push({
            path: fullPath,
            relativePath: relative(this.rootDir, fullPath),
            name: entry.name,
            ext,
          });
        }
      }
    }
  }

  async readFileContent(filePath) {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }
    try {
      const content = await readFile(filePath, 'utf-8');
      this.cache.set(filePath, content);
      return content;
    } catch {
      return null;
    }
  }

  async getFilesByPattern(dir, pattern) {
    const allFiles = await this.scanDirectory(dir);
    const regex = new RegExp(pattern);
    return allFiles.filter((f) => regex.test(f.relativePath));
  }

  async getFileStats(filePath) {
    try {
      return await stat(filePath);
    } catch {
      return null;
    }
  }

  clearCache() {
    this.cache.clear();
  }
}
