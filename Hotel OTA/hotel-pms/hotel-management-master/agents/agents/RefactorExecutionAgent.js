import { readFile, writeFile } from 'fs/promises';
import { BaseAgent } from '../core/BaseAgent.js';

/**
 * RefactorExecutionAgent - Generates fix plans and applies safe automated fixes.
 * Only executes in 'fix' mode. Generates plans in all modes.
 */
export class RefactorExecutionAgent extends BaseAgent {
  constructor() {
    super('RefactorExecutionAgent', 'Generates prioritized fix plans and applies safe automated refactors');
  }

  async analyze(state, config) {
    const { mode } = config;

    // Generate fix plan from all findings
    this._generateFixPlan(state);

    if (mode !== 'fix') {
      return {
        summary: `Generated fix plan with ${state.fixPlan.length} items (execution skipped — mode: ${mode})`,
        fixPlanSize: state.fixPlan.length,
        applied: 0,
      };
    }

    // Execute safe, automated fixes
    let applied = 0;
    for (const fix of state.fixPlan) {
      if (fix.autoFixable && fix.priority === 'critical') {
        try {
          const success = await this._applyFix(fix, config);
          if (success) {
            state.markFixApplied(fix.id);
            applied++;
          }
        } catch (error) {
          console.error(`[RefactorExecution] Failed to apply ${fix.id}: ${error.message}`);
        }
      }
    }

    return {
      summary: `Generated ${state.fixPlan.length} fixes, applied ${applied}`,
      fixPlanSize: state.fixPlan.length,
      applied,
    };
  }

  _generateFixPlan(state) {
    const severityPriority = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
      info: 'low',
    };

    for (const finding of state.findings) {
      if (!finding.fixable) continue;

      const fix = {
        findingId: finding.id,
        title: finding.title,
        file: finding.file,
        priority: severityPriority[finding.severity] || 'medium',
        category: finding.category,
        description: finding.suggestion || finding.description,
        autoFixable: this._isAutoFixable(finding),
        fixType: this._determineFixType(finding),
      };

      state.addToFixPlan(fix);
    }

    // Sort fix plan by priority
    state.fixPlan.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });
  }

  _isAutoFixable(finding) {
    // Only auto-fix safe, well-defined patterns
    const autoFixablePatterns = [
      'Deprecated Mongoose method',
      'Loose equality',
      'Empty catch block',
    ];

    return autoFixablePatterns.some((p) =>
      finding.title.includes(p) || finding.description.includes(p)
    );
  }

  _determineFixType(finding) {
    if (finding.category === 'security') return 'security-patch';
    if (finding.category === 'bug') return 'bugfix';
    if (finding.category === 'performance') return 'optimization';
    if (finding.category === 'architecture') return 'refactor';
    if (finding.category === 'concurrency') return 'concurrency-fix';
    return 'improvement';
  }

  async _applyFix(fix, config) {
    const { scanner, projectRoot } = config;

    if (!fix.file) return false;

    const filePath = fix.file.startsWith('/')
      ? fix.file
      : `${projectRoot}/${fix.file}`;

    const content = await scanner.readFileContent(filePath);
    if (!content) return false;

    let newContent = content;

    // Apply specific automated fixes
    if (fix.title.includes('Deprecated') && fix.title.includes('.update(')) {
      newContent = content.replace(/\.update\s*\(/g, '.updateOne(');
    } else if (fix.title.includes('Deprecated') && fix.title.includes('.remove(')) {
      newContent = content.replace(/\.remove\s*\(/g, '.deleteOne(');
    } else if (fix.title.includes('Deprecated') && fix.title.includes('.count(')) {
      newContent = content.replace(/\.count\s*\(/g, '.countDocuments(');
    } else {
      return false; // Don't know how to auto-fix this
    }

    if (newContent === content) return false;

    // Write the fix
    await writeFile(filePath, newContent, 'utf-8');
    console.log(`[RefactorExecution] Applied fix: ${fix.id} to ${fix.file}`);
    return true;
  }
}
