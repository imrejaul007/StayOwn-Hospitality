#!/usr/bin/env node

/**
 * Code Reviewer Agent System v2.0 — Entry Point
 *
 * An autonomous, multi-agent system for deep code review and analysis
 * of the Hotel Management System (PMS) codebase.
 *
 * 17 specialized agents across 5 phases:
 *   SCAN → ANALYSIS → DOMAIN → SYNTHESIS → EXECUTION
 *
 * Usage:
 *   node index.js                        # Full review (report only)
 *   node index.js --mode=fix             # Review + apply safe fixes
 *   node index.js --mode=report-only     # Generate report without fixes
 *   node index.js --agents=security      # Run only security agent
 *   node index.js --agents=bugs,security # Run specific agents
 *   node index.js --agents=all           # Run all agents (default)
 *   node index.js --parallel             # Run phase agents in parallel
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Core
import { AgentController } from './core/AgentController.js';

// ── Phase 1: SCAN agents ──
import { CodebaseAnalyzerAgent } from './agents/CodebaseAnalyzerAgent.js';

// ── Phase 2: ANALYSIS agents (core code quality) ──
import { DataFlowAgent } from './agents/DataFlowAgent.js';
import { BugDetectionAgent } from './agents/BugDetectionAgent.js';
import { SecurityAuditAgent } from './agents/SecurityAuditAgent.js';
import { PerformanceAgent } from './agents/PerformanceAgent.js';
import { ArchitectureAgent } from './agents/ArchitectureAgent.js';
import { ConcurrencyAgent } from './agents/ConcurrencyAgent.js';

// ── Phase 3: DOMAIN agents (PMS + product-level) ──
import { BookingSystemAgent } from './agents/BookingSystemAgent.js';
import { PaymentFlowAgent } from './agents/PaymentFlowAgent.js';
import { MultiTenancyIsolationAgent } from './agents/MultiTenancyIsolationAgent.js';
import { HotelOperationsAgent } from './agents/HotelOperationsAgent.js';

// ── Phase 4: SYNTHESIS agents (cross-cutting concerns) ──
import { ComplianceAgent } from './agents/ComplianceAgent.js';
import { APIDesignAgent } from './agents/APIDesignAgent.js';
import { TestCoverageAgent } from './agents/TestCoverageAgent.js';
import { FrontendQualityAgent } from './agents/FrontendQualityAgent.js';
import { ErrorResilienceAgent } from './agents/ErrorResilienceAgent.js';
import { BusinessLogicCompletenessAgent } from './agents/BusinessLogicCompletenessAgent.js';

// ── Phase 5: EXECUTION agent ──
import { RefactorExecutionAgent } from './agents/RefactorExecutionAgent.js';

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: 'report-only',
    agents: 'all',
    parallel: false,
    verbose: true,
    outputDir: resolve(dirname(fileURLToPath(import.meta.url)), 'reports'),
  };

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1];
    } else if (arg.startsWith('--agents=')) {
      options.agents = arg.split('=')[1];
    } else if (arg === '--parallel') {
      options.parallel = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--quiet') {
      options.verbose = false;
    } else if (arg.startsWith('--output=')) {
      options.outputDir = resolve(arg.split('=')[1]);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(__dirname, '..');

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           CODE REVIEWER AGENT SYSTEM v2.0                       ║');
  console.log('║   17-Agent Deep Analysis for Hotel Management PMS               ║');
  console.log('║   Thinking like 20+ Product Managers                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const controller = new AgentController(projectRoot, options);

  // ═══════════════════════════════════════════════
  // Phase 1: SCAN — Build codebase context
  // ═══════════════════════════════════════════════
  controller.register(new CodebaseAnalyzerAgent(), {
    phase: 'scan',
    priority: 10,
  });

  // ═══════════════════════════════════════════════
  // Phase 2: ANALYSIS — Core code quality agents
  // ═══════════════════════════════════════════════
  controller.register(new DataFlowAgent(), {
    phase: 'analysis',
    priority: 20,
  });

  controller.register(new BugDetectionAgent(), {
    phase: 'analysis',
    priority: 30,
  });

  controller.register(new SecurityAuditAgent(), {
    phase: 'analysis',
    priority: 40,
  });

  controller.register(new PerformanceAgent(), {
    phase: 'analysis',
    priority: 50,
  });

  controller.register(new ArchitectureAgent(), {
    phase: 'analysis',
    priority: 60,
  });

  controller.register(new ConcurrencyAgent(), {
    phase: 'analysis',
    priority: 70,
  });

  // ═══════════════════════════════════════════════
  // Phase 3: DOMAIN — PMS-specific + product agents
  // ═══════════════════════════════════════════════
  controller.register(new BookingSystemAgent(), {
    phase: 'domain',
    priority: 10,
  });

  controller.register(new PaymentFlowAgent(), {
    phase: 'domain',
    priority: 20,
  });

  controller.register(new MultiTenancyIsolationAgent(), {
    phase: 'domain',
    priority: 30,
  });

  controller.register(new HotelOperationsAgent(), {
    phase: 'domain',
    priority: 40,
  });

  // ═══════════════════════════════════════════════
  // Phase 4: SYNTHESIS — Cross-cutting concerns
  // ═══════════════════════════════════════════════
  controller.register(new ComplianceAgent(), {
    phase: 'synthesis',
    priority: 10,
  });

  controller.register(new APIDesignAgent(), {
    phase: 'synthesis',
    priority: 20,
  });

  controller.register(new TestCoverageAgent(), {
    phase: 'synthesis',
    priority: 30,
  });

  controller.register(new FrontendQualityAgent(), {
    phase: 'synthesis',
    priority: 40,
  });

  controller.register(new ErrorResilienceAgent(), {
    phase: 'synthesis',
    priority: 50,
  });

  controller.register(new BusinessLogicCompletenessAgent(), {
    phase: 'synthesis',
    priority: 60,
  });

  // ═══════════════════════════════════════════════
  // Phase 5: EXECUTION — Fix planning + application
  // ═══════════════════════════════════════════════
  controller.register(new RefactorExecutionAgent(), {
    phase: 'execution',
    priority: 10,
  });

  // ── Run ──
  try {
    const state = await controller.run();

    // Print comprehensive final summary
    console.log('\n┌────────────────────────────────────────────┐');
    console.log('│            FINDINGS SUMMARY                │');
    console.log('├────────────────────────────────────────────┤');

    const severities = ['critical', 'high', 'medium', 'low', 'info'];
    const icons = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: 'ℹ️ ' };

    for (const sev of severities) {
      const count = state.getFindingsBySeverity(sev).length;
      if (count > 0) {
        console.log(`│  ${icons[sev]} ${sev.toUpperCase().padEnd(10)} ${String(count).padStart(5)} findings  │`);
      }
    }

    console.log('├────────────────────────────────────────────┤');
    console.log(`│  TOTAL           ${String(state.findings.length).padStart(5)} findings  │`);
    console.log(`│  DEDUPLICATED    ${String(state.metadata.deduplicated).padStart(5)} removed   │`);
    console.log(`│  CONSOLIDATED    ${String(state.metadata.consolidated).padStart(5)} grouped   │`);
    console.log(`│  FIX PLAN        ${String(state.fixPlan.length).padStart(5)} items     │`);
    console.log(`│  APPLIED         ${String(state.appliedFixes.length).padStart(5)} fixes     │`);
    console.log('├────────────────────────────────────────────┤');

    // Category breakdown
    const categories = {};
    state.findings.forEach((f) => { categories[f.category] = (categories[f.category] || 0) + 1; });
    console.log('│  BY CATEGORY                               │');
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`│    ${cat.padEnd(22)} ${String(count).padStart(5)}        │`);
      });

    console.log('└────────────────────────────────────────────┘');

    console.log(`\nReports saved to: ${options.outputDir}/`);

    // Exit with non-zero if critical findings
    const criticalCount = state.getFindingsBySeverity('critical').length;
    if (criticalCount > 0) {
      console.log(`\n⚠️  ${criticalCount} CRITICAL findings require immediate attention!\n`);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n[FATAL] Agent system crashed:', error);
    console.error(error.stack);
    process.exit(2);
  }
}

main();
