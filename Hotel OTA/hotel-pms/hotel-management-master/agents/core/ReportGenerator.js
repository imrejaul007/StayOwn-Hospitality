import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * ReportGenerator - Generates structured audit reports from agent findings.
 * Outputs both JSON (machine-readable) and Markdown (human-readable) reports.
 */
export class ReportGenerator {
  constructor(state, outputDir) {
    this.state = state;
    this.outputDir = outputDir;
  }

  async generate() {
    await mkdir(this.outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    await Promise.all([
      this._writeJSON(join(this.outputDir, `audit-report-${timestamp}.json`)),
      this._writeMarkdown(join(this.outputDir, `audit-report-${timestamp}.md`)),
      this._writeFixPlan(join(this.outputDir, `fix-plan-${timestamp}.md`)),
      this._writeSummary(join(this.outputDir, `summary-${timestamp}.md`)),
    ]);

    console.log(`\n[REPORT] Reports written to ${this.outputDir}/`);
  }

  async _writeJSON(filePath) {
    await writeFile(filePath, JSON.stringify(this.state.toJSON(), null, 2));
    console.log(`[REPORT] JSON report: ${filePath}`);
  }

  async _writeMarkdown(filePath) {
    const { findings, metadata } = this.state;

    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    const grouped = {};
    for (const sev of severityOrder) {
      grouped[sev] = findings.filter((f) => f.severity === sev);
    }

    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      info: 'ℹ️',
    };

    let md = `# Code Review Audit Report\n\n`;
    md += `**Project:** Hotel Management System (PMS)\n`;
    md += `**Generated:** ${new Date().toISOString()}\n`;
    md += `**Duration:** ${metadata.durationMs}ms\n`;
    md += `**Agents Run:** ${metadata.agentsRun.join(', ')}\n`;
    md += `**Total Findings:** ${metadata.totalFindings}\n\n`;

    // Summary table
    md += `## Summary\n\n`;
    md += `| Severity | Count |\n|----------|-------|\n`;
    for (const sev of severityOrder) {
      md += `| ${severityEmoji[sev]} ${sev.toUpperCase()} | ${grouped[sev].length} |\n`;
    }
    md += `\n`;

    // Category breakdown
    const categories = {};
    for (const f of findings) {
      categories[f.category] = (categories[f.category] || 0) + 1;
    }
    md += `## By Category\n\n`;
    md += `| Category | Count |\n|----------|-------|\n`;
    for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
      md += `| ${cat} | ${count} |\n`;
    }
    md += `\n`;

    // Detailed findings by severity
    for (const sev of severityOrder) {
      if (grouped[sev].length === 0) continue;
      md += `## ${severityEmoji[sev]} ${sev.toUpperCase()} Findings\n\n`;

      for (const f of grouped[sev]) {
        md += `### ${f.id}: ${f.title}\n\n`;
        md += `- **Agent:** ${f.agent}\n`;
        md += `- **Category:** ${f.category}\n`;
        if (f.file) md += `- **File:** \`${f.file}\`\n`;
        if (f.line) md += `- **Line:** ${f.line}\n`;
        md += `- **Fixable:** ${f.fixable ? 'Yes' : 'No'}\n`;
        md += `\n${f.description}\n\n`;
        if (f.suggestion) {
          md += `**Suggestion:** ${f.suggestion}\n\n`;
        }
        md += `---\n\n`;
      }
    }

    await writeFile(filePath, md);
    console.log(`[REPORT] Markdown report: ${filePath}`);
  }

  async _writeFixPlan(filePath) {
    const { fixPlan } = this.state;

    let md = `# Fix Plan\n\n`;
    md += `**Total Fixes:** ${fixPlan.length}\n`;
    md += `**Applied:** ${fixPlan.filter((f) => f.status === 'applied').length}\n`;
    md += `**Pending:** ${fixPlan.filter((f) => f.status === 'pending').length}\n\n`;

    // Group by priority
    const priorityGroups = { critical: [], high: [], medium: [], low: [] };
    for (const fix of fixPlan) {
      const group = priorityGroups[fix.priority] || priorityGroups.medium;
      group.push(fix);
    }

    for (const [priority, fixes] of Object.entries(priorityGroups)) {
      if (fixes.length === 0) continue;
      md += `## ${priority.toUpperCase()} Priority\n\n`;

      for (const fix of fixes) {
        const status = fix.status === 'applied' ? '[x]' : '[ ]';
        md += `- ${status} **${fix.id}**: ${fix.title}\n`;
        md += `  - File: \`${fix.file}\`\n`;
        md += `  - Finding: ${fix.findingId}\n`;
        if (fix.description) md += `  - ${fix.description}\n`;
        md += `\n`;
      }
    }

    await writeFile(filePath, md);
    console.log(`[REPORT] Fix plan: ${filePath}`);
  }

  async _writeSummary(filePath) {
    const { metadata, findings } = this.state;
    const agentResults = this.state.agentResults;

    let md = `# Executive Summary\n\n`;
    md += `## Overview\n\n`;
    md += `The Code Reviewer Agent system analyzed the Hotel Management System (PMS) codebase.\n\n`;
    md += `- **Files Analyzed:** ${metadata.filesAnalyzed}\n`;
    md += `- **Agents Deployed:** ${metadata.agentsRun.length}\n`;
    md += `- **Total Findings:** ${metadata.totalFindings}\n`;
    md += `- **Analysis Duration:** ${(metadata.durationMs / 1000).toFixed(1)}s\n\n`;

    // Risk assessment
    const critical = findings.filter((f) => f.severity === 'critical').length;
    const high = findings.filter((f) => f.severity === 'high').length;

    let riskLevel = 'LOW';
    if (critical > 0) riskLevel = 'CRITICAL';
    else if (high > 5) riskLevel = 'HIGH';
    else if (high > 0) riskLevel = 'MEDIUM';

    md += `## Risk Assessment: **${riskLevel}**\n\n`;

    if (critical > 0) {
      md += `### Critical Issues Requiring Immediate Attention\n\n`;
      for (const f of findings.filter((f) => f.severity === 'critical')) {
        md += `1. **${f.title}** (${f.file || 'multiple files'})\n   ${f.description.split('\n')[0]}\n\n`;
      }
    }

    // Agent performance
    md += `## Agent Results\n\n`;
    md += `| Agent | Findings | Duration |\n|-------|----------|----------|\n`;
    for (const [name, result] of agentResults) {
      md += `| ${name} | ${result.findingsCount || 0} | ${result.durationMs}ms |\n`;
    }
    md += `\n`;

    // Top recommendations
    md += `## Top Recommendations\n\n`;
    const topFindings = findings
      .filter((f) => f.severity === 'critical' || f.severity === 'high')
      .slice(0, 10);

    for (let i = 0; i < topFindings.length; i++) {
      const f = topFindings[i];
      md += `${i + 1}. **${f.title}** [${f.severity.toUpperCase()}]\n`;
      if (f.suggestion) md += `   → ${f.suggestion}\n`;
      md += `\n`;
    }

    await writeFile(filePath, md);
    console.log(`[REPORT] Executive summary: ${filePath}`);
  }
}
