import { BaseAgent } from '../core/BaseAgent.js';

/**
 * PerformanceAgent - Detects performance anti-patterns and optimization opportunities.
 * Checks for N+1 queries, missing indexes, unbounded queries, memory leaks.
 */
export class PerformanceAgent extends BaseAgent {
  constructor() {
    super('PerformanceAgent', 'Detects N+1 queries, missing indexes, unbounded queries, memory leaks, and optimization opportunities');
  }

  async analyze(state, config) {
    const { scanner } = config;
    const allFiles = [
      ...(state.context.files.controllers || []),
      ...(state.context.files.services || []),
      ...(state.context.files.routes || []),
    ];

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      this._checkNPlusOne(state, content, file);
      this._checkUnboundedQueries(state, content, file);
      this._checkMissingLean(state, content, file);
      this._checkMemoryLeaks(state, content, file);
      this._checkLargePayloads(state, content, file);
      this._checkSyncOperations(state, content, file);
      this._checkCaching(state, content, file);
      this._checkAggregation(state, content, file);
    }

    // Check model indexes
    this._checkModelIndexes(state);

    return {
      summary: `Performance analysis complete across ${allFiles.length} files`,
      filesAnalyzed: allFiles.length,
    };
  }

  _checkNPlusOne(state, content, file) {
    // Detect queries inside loops
    const loopPatterns = [
      /for\s*\([^)]*\)\s*\{[\s\S]*?(?:\.find|\.findOne|\.findById|\.aggregate)\s*\(/g,
      /\.forEach\s*\([^)]*\)\s*\{?[\s\S]*?(?:\.find|\.findOne|\.findById|\.aggregate)\s*\(/g,
      /\.map\s*\([^)]*\)\s*(?:=>)?\s*\{?[\s\S]*?(?:\.find|\.findOne|\.findById|\.aggregate)\s*\(/g,
      /while\s*\([^)]*\)\s*\{[\s\S]*?(?:\.find|\.findOne|\.findById|\.aggregate)\s*\(/g,
    ];

    for (const pattern of loopPatterns) {
      let match;
      while ((match = pattern.exec(content))) {
        // Skip if the loop uses Promise.all (parallel execution, not serial N+1)
        const surroundingCode = content.substring(Math.max(0, match.index - 200), match.index + match[0].length + 200);
        if (/Promise\.all|Promise\.allSettled|\.map\(.*=>\s*\{[\s\S]*?return/.test(surroundingCode)) continue;

        const lineNum = content.substring(0, match.index).split('\n').length;
        this.addFinding(state, {
          severity: 'high',
          category: 'performance',
          title: 'N+1 query pattern detected',
          description: `Database query inside a loop at line ${lineNum} in ${file.relativePath}. Each iteration triggers a separate DB query, causing O(N) queries instead of O(1). For 100 items, this means 100 DB round-trips.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Use .find({ _id: { $in: ids } }) or .populate() to batch queries. Use $lookup in aggregation pipeline for joins.',
          fixable: true,
        });
        break; // One finding per file
      }
    }
  }

  _checkUnboundedQueries(state, content, file) {
    // Skip files using pagination middleware or helpers
    if (/paginat|\.skip\s*\(|\.limit\s*\(|pageSize|perPage|pagination/i.test(content)) return;

    // .find() without .limit()
    const unboundedFind = /\.find\s*\([^)]*\)(?![\s\S]{0,100}\.limit\s*\()/g;
    let count = 0;
    let match;
    while ((match = unboundedFind.exec(content))) {
      // Check if there's a limit nearby
      const after = content.substring(match.index, match.index + 200);
      if (!after.includes('.limit(') && !after.includes('.paginate(') && !after.includes('.skip(')) {
        count++;
      }
    }

    if (count > 0) {
      this.addFinding(state, {
        severity: 'low',
        category: 'performance',
        title: `${count} unbounded .find() queries without .limit()`,
        description: `${file.relativePath} has ${count} .find() calls without .limit(). These will return all matching documents, which can be catastrophic with large collections (millions of docs).`,
        file: file.relativePath,
        suggestion: 'Add .limit() to all .find() queries. Implement cursor-based or offset pagination.',
        fixable: true,
      });
    }
  }

  _checkMissingLean(state, content, file) {
    // If file already uses .lean() in some queries, it's aware of the pattern — skip
    const leanUsage = (content.match(/\.lean\s*\(\s*\)/g) || []).length;
    if (leanUsage > 2) return; // File already uses lean extensively

    // .find() without .lean() when result is only read (not modified)
    const findWithoutLean = /\.find(?:One|ById)?\s*\([^)]*\)(?![\s\S]{0,200}\.lean\s*\()/g;
    let count = 0;
    let match;
    while ((match = findWithoutLean.exec(content))) {
      const after = content.substring(match.index, match.index + 300);
      // Skip if the result is being modified (.save(), etc.)
      if (!after.includes('.save(') && !after.includes('.lean(') && !after.includes('.populate(')) {
        count++;
      }
    }

    if (count > 3) {
      this.addFinding(state, {
        severity: 'low',
        category: 'performance',
        title: `Consider using .lean() for read-only queries`,
        description: `${file.relativePath} has ${count} queries that may benefit from .lean(). Lean queries return plain objects instead of Mongoose documents, using ~5x less memory and being significantly faster.`,
        file: file.relativePath,
        suggestion: 'Add .lean() to queries where you only read data (no .save()/.validate() needed).',
        fixable: true,
      });
    }
  }

  _checkMemoryLeaks(state, content, file) {
    // Growing arrays/objects without bounds
    const unboundedGrowth = /(?:push|unshift)\s*\([^)]*\)[\s\S]{0,50}(?:while|for|setInterval)/g;
    if (unboundedGrowth.test(content)) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'performance',
        title: 'Potential memory leak — unbounded array growth in loop',
        description: `${file.relativePath} appears to grow an array inside a loop without bounds. Over time this can exhaust available memory.`,
        file: file.relativePath,
        suggestion: 'Add size limits or use streaming/pagination to process data in chunks.',
        fixable: false,
      });
    }

    // Event listeners without cleanup
    const listenerPattern = /\.on\s*\(\s*['"][^'"]+['"]/g;
    const removePattern = /\.removeListener|\.off\s*\(|\.removeAllListeners/g;
    const listeners = content.match(listenerPattern);
    const removals = content.match(removePattern);

    if (listeners && listeners.length > 6 && (!removals || removals.length === 0)) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'performance',
        title: 'Event listeners without cleanup',
        description: `${file.relativePath} registers ${listeners.length} event listeners but never removes them. Repeated registration (e.g., per request) causes memory leaks.`,
        file: file.relativePath,
        suggestion: 'Use .once() for single-use listeners or remove listeners in cleanup/disconnect handlers.',
        fixable: true,
      });
    }
  }

  _checkLargePayloads(state, content, file) {
    // Returning entire documents without field selection
    const fullDocReturn = /res\.(?:json|send)\s*\(\s*(?:await\s+)?\w+\.find(?:One|ById|)?\s*\([^)]*\)\s*\)/g;
    if (fullDocReturn.test(content)) {
      this.addFinding(state, {
        severity: 'low',
        category: 'performance',
        title: 'Returning full documents without field selection',
        description: `${file.relativePath} returns complete database documents in API responses. This may include unnecessary fields, increasing payload size and bandwidth.`,
        file: file.relativePath,
        suggestion: 'Use .select("field1 field2") to return only needed fields.',
        fixable: true,
      });
    }
  }

  _checkSyncOperations(state, content, file) {
    // Skip config/script/migration files — they run once at startup
    if (file.relativePath.includes('config') || file.relativePath.includes('script') || file.relativePath.includes('migration')) return;

    // Synchronous file operations
    const syncOps = /(?:readFileSync|writeFileSync|readdirSync|statSync|existsSync|mkdirSync)/g;
    const matches = content.match(syncOps);
    if (matches && matches.length > 0) {
      // existsSync is generally acceptable
      const nonExistsSync = matches.filter((m) => m !== 'existsSync');
      if (nonExistsSync.length > 0) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'performance',
          title: `Synchronous file operations block the event loop`,
          description: `${file.relativePath} uses ${nonExistsSync.length} synchronous file system operations (${[...new Set(nonExistsSync)].join(', ')}). These block the Node.js event loop and prevent concurrent request handling.`,
          file: file.relativePath,
          suggestion: 'Use async variants (readFile, writeFile, readdir) from fs/promises.',
          fixable: true,
        });
      }
    }

    // JSON.parse/stringify on very large objects (can freeze event loop)
    if (/JSON\.(?:parse|stringify)\s*\(\s*\w+\s*\)/.test(content) && content.length > 10000) {
      // This is a heuristic — large files with JSON operations may process large payloads
    }
  }

  _checkCaching(state, content, file) {
    // Expensive operations that could benefit from caching
    const expensiveOps = [
      { regex: /\.aggregate\s*\(\s*\[/g, op: 'aggregation pipeline' },
      { regex: /\.countDocuments\s*\(/g, op: 'countDocuments' },
    ];

    for (const { regex, op } of expensiveOps) {
      if (regex.test(content)) {
        const usesCache = /redis|cache|Cache|memcache/i.test(content);
        if (!usesCache && file.relativePath.includes('service')) {
          this.addFinding(state, {
            severity: 'low',
            category: 'performance',
            title: `Expensive ${op} without caching`,
            description: `${file.relativePath} runs ${op} operations without apparent caching. Repeated execution on large collections is slow and puts load on the database.`,
            file: file.relativePath,
            suggestion: 'Cache results in Redis with a reasonable TTL (e.g., 5-15 minutes).',
            fixable: true,
          });
          break;
        }
      }
    }
  }

  _checkAggregation(state, content, file) {
    // Only flag in controller/route files, not analytics services
    if (!file.relativePath.includes('controller') && !file.relativePath.includes('route')) return;

    // Aggregation pipelines without $match early
    const aggPipeline = /\.aggregate\s*\(\s*\[\s*\{\s*\$(?!match)/g;
    if (aggPipeline.test(content)) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'performance',
        title: 'Aggregation pipeline without $match as first stage',
        description: `${file.relativePath} has an aggregation pipeline that doesn't start with $match. Without early filtering, the pipeline processes the entire collection.`,
        file: file.relativePath,
        suggestion: 'Add $match as the first stage to filter documents early and use indexes.',
        fixable: true,
      });
    }
  }

  _checkModelIndexes(state) {
    // Check models for common query patterns without indexes
    for (const [modelName, modelInfo] of state.context.models) {
      if (modelInfo.indexes.length === 0 && modelInfo.fields.length > 5) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'performance',
          title: `Model "${modelName}" has no explicit indexes`,
          description: `The "${modelName}" model in ${modelInfo.file} has ${modelInfo.fields.length} fields but no explicit indexes. Queries on non-indexed fields perform full collection scans.`,
          file: modelInfo.file,
          suggestion: `Add indexes for frequently queried fields. Common: { hotelId: 1 }, { status: 1 }, { createdAt: -1 }.`,
          fixable: true,
        });
      }
    }
  }
}
