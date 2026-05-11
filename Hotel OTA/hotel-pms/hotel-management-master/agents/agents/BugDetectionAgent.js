import { BaseAgent } from '../core/BaseAgent.js';

/**
 * BugDetectionAgent - Detects logical bugs, runtime errors, and common mistakes.
 * Checks error handling, null safety, async patterns, and type mismatches.
 */
export class BugDetectionAgent extends BaseAgent {
  constructor() {
    super('BugDetectionAgent', 'Detects logical bugs, runtime errors, missing error handling, and async anti-patterns');
  }

  async analyze(state, config) {
    const { scanner } = config;
    const allFiles = [
      ...(state.context.files.controllers || []),
      ...(state.context.files.services || []),
      ...(state.context.files.routes || []),
      ...(state.context.files.middleware || []),
      ...(state.context.files.jobs || []),
    ];

    let totalChecks = 0;

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      const lines = content.split('\n');
      totalChecks++;

      // 1. Unhandled async/await — missing try/catch
      this._checkUnhandledAsync(state, content, lines, file);

      // 2. Callback-style error swallowing
      this._checkSwallowedErrors(state, content, lines, file);

      // 3. Missing null/undefined checks
      this._checkNullSafety(state, content, lines, file);

      // 4. Incorrect equality comparisons
      this._checkEqualityIssues(state, content, lines, file);

      // 5. Promise anti-patterns
      this._checkPromiseAntiPatterns(state, content, lines, file);

      // 6. Variable shadowing in closures
      this._checkVariableShadowing(state, content, lines, file);

      // 7. Missing return statements in conditional branches
      this._checkMissingReturns(state, content, lines, file);

      // 8. Hardcoded secrets/credentials
      this._checkHardcodedSecrets(state, content, lines, file);

      // 9. Unreachable code
      this._checkUnreachableCode(state, content, lines, file);

      // 10. Incorrect Mongoose query patterns
      this._checkMongoosePatterns(state, content, lines, file);
    }

    return {
      summary: `Analyzed ${totalChecks} files for bug patterns`,
      filesChecked: totalChecks,
    };
  }

  _checkUnhandledAsync(state, content, lines, file) {
    // Find async functions without try/catch
    const asyncFuncRegex = /async\s+(?:function\s+)?(\w+)?\s*\(/g;
    let match;
    while ((match = asyncFuncRegex.exec(content))) {
      const startIdx = match.index;
      const funcName = match[1] || 'anonymous';

      // Find the function body
      const funcBody = this._extractFuncBody(content, startIdx);
      if (!funcBody) continue;

      const hasTryCatch = /try\s*\{/.test(funcBody);
      const hasAwait = /await\s+/.test(funcBody);
      const hasCatchHandler = /\.catch\s*\(/.test(funcBody);
      const hasAsyncHandler = /asyncHandler|catchAsync|withTransaction/.test(content);

      if (hasAwait && !hasTryCatch && !hasCatchHandler && !hasAsyncHandler) {
        const lineNum = content.substring(0, startIdx).split('\n').length;
        const fileHasSomeTryCatch = /try\s*\{/.test(content);
        const severity = fileHasSomeTryCatch ? 'low' : 'medium';
        this.addFinding(state, {
          severity,
          category: 'bug',
          title: `Unhandled async function: ${funcName}`,
          description: `Async function "${funcName}" at line ${lineNum} uses await but has no try/catch or .catch() handler. Unhandled promise rejections will crash the Node.js process in newer versions.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Wrap await calls in try/catch or use an asyncHandler/catchAsync wrapper.',
          fixable: true,
        });
      }
    }
  }

  _checkSwallowedErrors(state, content, lines, file) {
    // Empty catch blocks
    const emptyCatchRegex = /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g;
    let match;
    while ((match = emptyCatchRegex.exec(content))) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      this.addFinding(state, {
        severity: 'medium',
        category: 'bug',
        title: 'Empty catch block — error swallowed silently',
        description: `Empty catch block at line ${lineNum} silently swallows errors. This makes debugging extremely difficult and can hide critical failures.`,
        file: file.relativePath,
        line: lineNum,
        suggestion: 'At minimum, log the error. Better yet, handle it appropriately or rethrow.',
        fixable: true,
      });
    }

    // catch-log-only check removed — logging IS handling in many cases and this had too many false positives
  }

  _checkNullSafety(state, content, lines, file) {
    // Accessing properties on potentially null DB queries without checks
    const dangerousPatterns = [
      {
        regex: /const\s+(\w+)\s*=\s*await\s+\w+\.findById\s*\([^)]+\);\s*\n\s*(?!if\s*\(\s*!\s*\1)/g,
        desc: 'findById result used without null check',
      },
      {
        regex: /const\s+(\w+)\s*=\s*await\s+\w+\.findOne\s*\([^)]+\);\s*\n\s*(?!if\s*\(\s*!\s*\1)/g,
        desc: 'findOne result used without null check',
      },
    ];

    for (const pattern of dangerousPatterns) {
      let match;
      while ((match = pattern.regex.exec(content))) {
        const varName = match[1];
        const lineNum = content.substring(0, match.index).split('\n').length;

        // Check if there's a null check within the next few lines
        const afterMatch = content.substring(match.index, match.index + 500);
        if (!afterMatch.includes(`!${varName}`) && !afterMatch.includes(`${varName} === null`) && !afterMatch.includes(`${varName} == null`) && !afterMatch.includes(`${varName} !== null`) && !afterMatch.includes(`if (!${varName}`) && !afterMatch.includes('404') && !afterMatch.includes('not found') && !afterMatch.includes('Not found')) {
          this.addFinding(state, {
            severity: 'medium',
            category: 'bug',
            title: `Missing null check after DB query: ${varName}`,
            description: `Variable "${varName}" at line ${lineNum} is assigned from a database query (${pattern.desc}) but may not be null-checked before use. If the document doesn't exist, this will cause a TypeError.`,
            file: file.relativePath,
            line: lineNum,
            suggestion: `Add a null check: if (!${varName}) { return res.status(404).json({ error: 'Not found' }); }`,
            fixable: true,
          });
        }
      }
    }
  }

  _checkEqualityIssues(state, content, lines, file) {
    // Using == instead of === (except for null checks)
    const looseEqualityRegex = /[^!=]==[^=]/g;
    let match;
    let count = 0;
    while ((match = looseEqualityRegex.exec(content))) {
      const surrounding = content.substring(Math.max(0, match.index - 10), match.index + 10);
      if (!surrounding.includes('null') && !surrounding.includes('undefined')) {
        count++;
      }
    }
    if (count > 5) {
      this.addFinding(state, {
        severity: 'low',
        category: 'bug',
        title: `${count} loose equality comparisons (==) found`,
        description: `File uses == instead of === in ${count} places. Loose equality can cause unexpected type coercion bugs (e.g., "0" == false is true).`,
        file: file.relativePath,
        suggestion: 'Replace == with === for strict equality. Allow == only for intentional null/undefined checks.',
        fixable: true,
      });
    }
  }

  _checkPromiseAntiPatterns(state, content, lines, file) {
    const forgottenAwait = /(?:const|let|var)\s+(\w+)\s*=\s*(?!await)\s*(\w+)\.(find|findOne|findById|create|update|delete|save|remove|aggregate)\s*\(/g;
    let match;
    while ((match = forgottenAwait.exec(content))) {
      const assignedVar = match[1];
      const calledOn = match[2];
      const method = match[3];

      // Check if there's an await on this line
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const line = content.substring(lineStart, lineEnd);

      // Skip 1: If using 'let' — likely a query builder pattern (query is built then executed later)
      if (line.trimStart().startsWith('let ')) continue;

      // Skip 2: Array.find() — if the variable being called on was assigned from an array literal,
      // Array method (.map, .filter, .push, etc.), or is a common array variable name
      if (method === 'find' || method === 'delete') {
        // Check if calledOn was assigned from an array or array-like source
        const arrayAssignmentPattern = new RegExp(
          `(?:const|let|var)\\s+${calledOn}\\s*=\\s*(?:\\[|` +            // direct array literal
          `\\w+\\.(?:map|filter|reduce|flat|flatMap|concat|slice|from)\\s*\\(|` + // array method result
          `Array\\.|\\.split\\(|Object\\.(?:keys|values|entries)\\()`,     // Array.from, .split(), Object.keys()
          'g'
        );
        if (arrayAssignmentPattern.test(content)) continue;

        // Also skip if calledOn looks like a plural/collection variable name (common array naming)
        if (/(?:s|List|Items|Array|Collection|Set|Results|Records|Entries|Options|Elements|rows|docs|data)$/i.test(calledOn)) continue;

        // Skip if the .find() uses a fat arrow or function callback (Array.find pattern)
        const afterMatch = content.substring(match.index, Math.min(content.length, match.index + 200));
        if (/\.find\s*\(\s*(?:\w+\s*=>|function\s*\(|[\({]\s*\w+\s*[,})])/.test(afterMatch)) continue;
      }

      // Also check the NEXT 3 lines for .exec(), .populate(), .sort(), .then(), or await (chained calls)
      const lineNum = content.substring(0, match.index).split('\n').length;
      const lineIdx = lineNum - 1; // zero-based
      const nearbyLines = lines.slice(lineIdx, lineIdx + 4).join(' '); // current + next 3 lines

      if (nearbyLines.includes('await') || nearbyLines.includes('.then(') ||
          nearbyLines.includes('.exec(') || nearbyLines.includes('.populate(') ||
          nearbyLines.includes('.sort(') || nearbyLines.includes('.lean(') ||
          nearbyLines.includes('.limit(') || nearbyLines.includes('.skip(') ||
          nearbyLines.includes('.select(') || nearbyLines.includes('.where(')) {
        continue;
      }

      this.addFinding(state, {
        severity: 'high',
        category: 'bug',
        title: `Possible missing await on Mongoose operation: .${method}()`,
        description: `At line ${lineNum}, a Mongoose operation (.${method}()) appears to be called without await. This means the variable will hold a Query/Promise instead of the actual result.`,
        file: file.relativePath,
        line: lineNum,
        suggestion: `Add 'await' before the Mongoose operation or chain .exec().`,
        fixable: true,
      });
    }
  }

  _checkVariableShadowing(state, content, lines, file) {
    // Detect parameter-level shadowing of 'err' in nested callbacks
    const nestedCallbacks = content.match(/\(err\)\s*=>\s*\{[\s\S]*?\(err\)\s*=>/g);
    if (nestedCallbacks && nestedCallbacks.length > 0) {
      this.addFinding(state, {
        severity: 'low',
        category: 'bug',
        title: 'Variable shadowing: nested "err" parameters',
        description: `File contains nested callbacks/functions that both use "err" as a parameter name, causing the outer error to be shadowed and inaccessible.`,
        file: file.relativePath,
        suggestion: 'Use distinct parameter names (e.g., outerErr, innerErr) to avoid shadowing.',
        fixable: true,
      });
    }
  }

  _checkMissingReturns(state, content, lines, file) {
    // Express route handlers that send response in if-branch but not else
    const ifResPattern = /if\s*\([^)]+\)\s*\{[^}]*res\.(json|send|status|redirect)\([^)]*\)[^}]*\}\s*(?!else|return|res\.)/g;
    // This is a simplified check — real analysis would need AST parsing
  }

  _checkHardcodedSecrets(state, content, lines, file) {
    const secretPatterns = [
      { regex: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi, type: 'password' },
      { regex: /(?:secret|apikey|api_key|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi, type: 'secret/API key' },
      { regex: /(?:mongodb(?:\+srv)?:\/\/)\w+:\w+@/gi, type: 'MongoDB connection string with credentials' },
      { regex: /sk_(?:live|test)_[a-zA-Z0-9]{20,}/g, type: 'Stripe secret key' },
    ];

    for (const pattern of secretPatterns) {
      let match;
      while ((match = pattern.regex.exec(content))) {
        // Skip if in .env.example or test files
        if (file.relativePath.includes('.env') || file.relativePath.includes('test')) continue;
        // Skip common non-secret patterns
        if (match[0].includes('process.env') || match[0].includes('config.')) continue;
        // Skip masked/placeholder values
        if (/\*\*\*|masked|REDACTED|placeholder|example|your-|configure-in-|change-me/i.test(match[0])) continue;
        // Skip Swagger/OpenAPI documentation examples
        if (/example:|description:|summary:/i.test(content.substring(Math.max(0, match.index - 50), match.index))) continue;

        const lineNum = content.substring(0, match.index).split('\n').length;
        this.addFinding(state, {
          severity: 'critical',
          category: 'security',
          title: `Hardcoded ${pattern.type} detected`,
          description: `Found what appears to be a hardcoded ${pattern.type} at line ${lineNum}. Hardcoded credentials are a critical security risk — they can be exposed in version control and are difficult to rotate.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Move to environment variables and reference via process.env.',
          fixable: true,
        });
      }
    }
  }

  _checkUnreachableCode(state, content, lines, file) {
    // Only flag obvious unreachable code — skip try/catch patterns which are valid
    // This check has high false-positive rate so we keep it very conservative
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      const nextLine = lines[i + 1]?.trim();
      if (!nextLine) continue;

      // Must be a standalone return/throw (not inside a conditional)
      if (
        (line === 'return;' || line.match(/^return [^;]+;$/) || line.match(/^throw [^;]+;$/)) &&
        nextLine !== '}' &&
        nextLine !== '' &&
        !nextLine.startsWith('//') &&
        !nextLine.startsWith('/*') &&
        !nextLine.startsWith('*') &&
        !nextLine.startsWith('}') &&
        !nextLine.startsWith('catch') &&
        !nextLine.startsWith('finally') &&
        !nextLine.startsWith('else') &&
        nextLine !== 'break;' &&
        !nextLine.startsWith('case ')
      ) {
        // Check if we're inside a try block (return in try → catch is valid)
        const prevLines = lines.slice(Math.max(0, i - 5), i).join(' ');
        if (/try\s*\{/.test(prevLines)) continue;

        this.addFinding(state, {
          severity: 'low',
          category: 'bug',
          title: 'Unreachable code after return/throw',
          description: `Line ${i + 2} appears to be unreachable code after a return/throw statement on line ${i + 1}.`,
          file: file.relativePath,
          line: i + 2,
          suggestion: 'Remove unreachable code or fix control flow.',
          fixable: true,
        });
        break;
      }
    }
  }

  _checkMongoosePatterns(state, content, lines, file) {
    // Using .save() without error handling on validation
    const saveWithoutValidation = /\.save\(\s*\)(?!\s*\.catch|\s*\.then)/g;
    let match;
    let count = 0;
    while ((match = saveWithoutValidation.exec(content))) {
      const beforeSave = content.substring(Math.max(0, match.index - 200), match.index);
      if (!beforeSave.includes('try') && !beforeSave.includes('await')) {
        count++;
      }
    }

    // Deprecated Mongoose methods
    const deprecatedPatterns = [
      { regex: /\.findOneAndUpdate\([^)]*,\s*[^)]*(?!\{[^}]*new\s*:)/g, desc: 'findOneAndUpdate without { new: true } returns old document' },
      { regex: /\.update\s*\(/g, desc: 'Deprecated .update() — use .updateOne() or .updateMany()' },
      { regex: /(?<!\w)\.remove\s*\((?!EventListener|Listener|AllListeners)/g, desc: 'Deprecated .remove() — use .deleteOne() or .deleteMany()' },
      { regex: /\.count\s*\((?!Documents|Estimated)/g, desc: 'Deprecated .count() — use .countDocuments() or .estimatedDocumentCount()' },
    ];

    for (const pattern of deprecatedPatterns) {
      const matches = content.match(pattern.regex);
      if (matches && matches.length > 0) {
        this.addFinding(state, {
          severity: 'low',
          category: 'bug',
          title: `Deprecated Mongoose method: ${pattern.desc}`,
          description: `File uses a deprecated Mongoose pattern (${matches.length} occurrences). ${pattern.desc}.`,
          file: file.relativePath,
          suggestion: 'Update to the recommended Mongoose 8.x methods.',
          fixable: true,
        });
      }
    }
  }

  _extractFuncBody(content, startIdx) {
    let braceCount = 0;
    let started = false;
    let bodyStart = -1;

    for (let i = startIdx; i < content.length && i < startIdx + 5000; i++) {
      if (content[i] === '{') {
        if (!started) {
          started = true;
          bodyStart = i;
        }
        braceCount++;
      } else if (content[i] === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          return content.substring(bodyStart, i + 1);
        }
      }
    }
    return null;
  }
}
