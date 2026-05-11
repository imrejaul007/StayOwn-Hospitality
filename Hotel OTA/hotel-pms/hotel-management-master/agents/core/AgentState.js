/**
 * AgentState - Shared state management for the agent system.
 * Maintains analysis context, findings, and inter-agent communication.
 */
export class AgentState {
  constructor() {
    this.findings = [];
    this._findingKeys = new Set(); // Deduplication index
    this._findingCounts = new Map(); // Track duplicate counts per title pattern
    this.context = {
      files: new Map(),
      models: new Map(),
      routes: new Map(),
      services: new Map(),
      controllers: new Map(),
      middleware: [],
      dataFlows: [],
    };
    this.agentResults = new Map();
    this.fixPlan = [];
    this.appliedFixes = [];
    this.metadata = {
      startTime: Date.now(),
      endTime: null,
      agentsRun: [],
      filesAnalyzed: 0,
      totalFindings: 0,
      deduplicated: 0,
      consolidated: 0,
    };

    // Max per-title cap to prevent noise
    // Higher cap for critical/high so fixes are visible; lower for medium/low
    this.MAX_PER_TITLE_CRITICAL = 50;
    this.MAX_PER_TITLE_HIGH = 25;
    this.MAX_PER_TITLE = 10; // medium/low
  }

  addFinding(finding) {
    // Deduplication: same title + same file = duplicate
    const dedupeKey = `${finding.title}::${finding.file || ''}`;
    if (this._findingKeys.has(dedupeKey)) {
      this.metadata.deduplicated++;
      return null;
    }
    this._findingKeys.add(dedupeKey);

    // Consolidation: cap repetitive findings per title pattern
    const titleBase = finding.title.replace(/:.*$/, '').replace(/\d+/g, 'N').trim();
    const currentCount = this._findingCounts.get(titleBase) || 0;
    this._findingCounts.set(titleBase, currentCount + 1);

    const capForSeverity = finding.severity === 'critical' ? this.MAX_PER_TITLE_CRITICAL
      : finding.severity === 'high' ? this.MAX_PER_TITLE_HIGH
      : this.MAX_PER_TITLE;

    if (currentCount >= capForSeverity) {
      // After cap, only count — don't add individual findings
      if (currentCount === capForSeverity) {
        // Add a consolidation summary finding
        const consolidated = {
          id: `F-${String(this.findings.length + 1).padStart(4, '0')}`,
          timestamp: new Date().toISOString(),
          agent: finding.agent,
          severity: finding.severity === 'critical' ? 'critical' : finding.severity === 'high' ? 'high' : 'medium',
          category: finding.category,
          title: `[CONSOLIDATED] "${titleBase}" — additional occurrences suppressed`,
          description: `This finding type appeared more than ${capForSeverity} times. First ${capForSeverity} instances are listed individually above. Remaining instances are consolidated here to reduce noise. Address the pattern systemically rather than fixing each instance individually.`,
          suggestion: finding.suggestion,
          fixable: finding.fixable,
        };
        this.findings.push(consolidated);
        this.metadata.consolidated++;
      }
      this.metadata.deduplicated++;
      return null;
    }

    const normalized = {
      id: `F-${String(this.findings.length + 1).padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      ...finding,
    };
    this.findings.push(normalized);
    this.metadata.totalFindings = this.findings.length;
    return normalized.id;
  }

  getFindingsByAgent(agentName) {
    return this.findings.filter((f) => f.agent === agentName);
  }

  getFindingsBySeverity(severity) {
    return this.findings.filter((f) => f.severity === severity);
  }

  getFindingsByCategory(category) {
    return this.findings.filter((f) => f.category === category);
  }

  setAgentResult(agentName, result) {
    this.agentResults.set(agentName, {
      ...result,
      completedAt: new Date().toISOString(),
    });
    if (!this.metadata.agentsRun.includes(agentName)) {
      this.metadata.agentsRun.push(agentName);
    }
  }

  getAgentResult(agentName) {
    return this.agentResults.get(agentName);
  }

  addToFixPlan(fix) {
    this.fixPlan.push({
      id: `FIX-${String(this.fixPlan.length + 1).padStart(4, '0')}`,
      status: 'pending',
      ...fix,
    });
  }

  markFixApplied(fixId) {
    const fix = this.fixPlan.find((f) => f.id === fixId);
    if (fix) {
      fix.status = 'applied';
      this.appliedFixes.push({ ...fix, appliedAt: new Date().toISOString() });
    }
  }

  finalize() {
    this.metadata.endTime = Date.now();
    this.metadata.durationMs = this.metadata.endTime - this.metadata.startTime;
  }

  toJSON() {
    return {
      metadata: this.metadata,
      findings: this.findings,
      fixPlan: this.fixPlan,
      appliedFixes: this.appliedFixes,
      agentResults: Object.fromEntries(this.agentResults),
    };
  }
}
