import { AgentState } from './AgentState.js';
import { FileScanner } from './FileScanner.js';
import { ReportGenerator } from './ReportGenerator.js';

/**
 * AgentController - Main orchestrator for the Code Reviewer Agent system.
 * Manages agent lifecycle, execution order, dynamic spawning, and report generation.
 */
export class AgentController {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.options = {
      mode: options.mode || 'full',           // 'full' | 'report-only' | 'fix'
      agents: options.agents || 'all',         // 'all' | comma-separated agent names
      parallel: options.parallel ?? false,      // Run independent agents in parallel
      verbose: options.verbose ?? true,
      outputDir: options.outputDir || './reports',
      ...options,
    };
    this.state = new AgentState();
    this.scanner = new FileScanner(projectRoot);
    this.registeredAgents = new Map();
    this.dynamicAgents = new Map();
    this.executionOrder = [];
  }

  /**
   * Register a specialized agent.
   */
  register(agent, { phase = 'analysis', priority = 50, dependsOn = [] } = {}) {
    this.registeredAgents.set(agent.name, {
      agent,
      phase,
      priority,
      dependsOn,
    });
    return this;
  }

  /**
   * Dynamically spawn a new agent at runtime.
   */
  spawnAgent(agent, { phase = 'dynamic', priority = 50, dependsOn = [] } = {}) {
    console.log(`[CONTROLLER] Dynamically spawning agent: ${agent.name}`);
    this.dynamicAgents.set(agent.name, {
      agent,
      phase,
      priority,
      dependsOn,
    });
    return agent;
  }

  /**
   * Get the execution plan based on phases and dependencies.
   */
  getExecutionPlan() {
    const allAgents = new Map([...this.registeredAgents, ...this.dynamicAgents]);
    const phases = ['scan', 'analysis', 'domain', 'dynamic', 'synthesis', 'execution'];
    const plan = [];

    // Filter agents if specific ones requested
    let agentFilter = null;
    if (this.options.agents !== 'all') {
      agentFilter = new Set(this.options.agents.split(',').map((a) => a.trim().toLowerCase()));
    }

    for (const phase of phases) {
      const phaseAgents = [];
      for (const [name, entry] of allAgents) {
        if (entry.phase === phase) {
          if (agentFilter && !agentFilter.has(name.toLowerCase())) continue;
          phaseAgents.push(entry);
        }
      }
      phaseAgents.sort((a, b) => a.priority - b.priority);
      if (phaseAgents.length > 0) {
        plan.push({ phase, agents: phaseAgents });
      }
    }

    return plan;
  }

  /**
   * Execute all agents according to the execution plan.
   */
  async run() {
    console.log('\n' + '='.repeat(70));
    console.log('  CODE REVIEWER AGENT SYSTEM');
    console.log('  Project: ' + this.projectRoot);
    console.log('  Mode: ' + this.options.mode);
    console.log('  Started: ' + new Date().toISOString());
    console.log('='.repeat(70) + '\n');

    const plan = this.getExecutionPlan();

    console.log('[CONTROLLER] Execution Plan:');
    for (const { phase, agents } of plan) {
      console.log(`  Phase: ${phase}`);
      for (const entry of agents) {
        console.log(`    - ${entry.agent.name} (priority: ${entry.priority})`);
      }
    }
    console.log('');

    // Execute phases sequentially, agents within a phase can run in parallel
    for (const { phase, agents } of plan) {
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`PHASE: ${phase.toUpperCase()}`);
      console.log(`${'─'.repeat(50)}`);

      if (this.options.parallel && agents.length > 1) {
        // Run agents in parallel within the phase
        const results = await Promise.allSettled(
          agents.map((entry) => this._runAgent(entry))
        );
        for (const result of results) {
          if (result.status === 'rejected') {
            console.error(`[CONTROLLER] Agent failed: ${result.reason.message}`);
          }
        }
      } else {
        // Run agents sequentially
        for (const entry of agents) {
          try {
            await this._runAgent(entry);
          } catch (error) {
            console.error(`[CONTROLLER] Agent ${entry.agent.name} failed: ${error.message}`);
          }
        }
      }

      // Check if any agent spawned dynamic agents for next phases
      if (this.dynamicAgents.size > 0) {
        const newPlan = this.getExecutionPlan();
        // Dynamic agents will be picked up in subsequent phases
      }
    }

    // Skip fix execution in report-only mode
    if (this.options.mode === 'report-only') {
      console.log('\n[CONTROLLER] Report-only mode — skipping fix execution.');
    }

    this.state.finalize();

    // Generate reports
    const reporter = new ReportGenerator(this.state, this.options.outputDir);
    await reporter.generate();

    console.log('\n' + '='.repeat(70));
    console.log('  REVIEW COMPLETE');
    console.log(`  Total Findings: ${this.state.metadata.totalFindings}`);
    console.log(`  Agents Run: ${this.state.metadata.agentsRun.length}`);
    console.log(`  Duration: ${this.state.metadata.durationMs}ms`);
    console.log(`  Critical: ${this.state.getFindingsBySeverity('critical').length}`);
    console.log(`  High: ${this.state.getFindingsBySeverity('high').length}`);
    console.log(`  Medium: ${this.state.getFindingsBySeverity('medium').length}`);
    console.log(`  Low: ${this.state.getFindingsBySeverity('low').length}`);
    console.log('='.repeat(70) + '\n');

    return this.state;
  }

  async _runAgent(entry) {
    const { agent } = entry;
    const config = {
      scanner: this.scanner,
      projectRoot: this.projectRoot,
      controller: this,
      mode: this.options.mode,
    };
    this.executionOrder.push(agent.name);
    return agent.run(this.state, config);
  }
}
