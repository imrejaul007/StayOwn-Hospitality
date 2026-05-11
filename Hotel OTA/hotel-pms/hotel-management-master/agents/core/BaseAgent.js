/**
 * BaseAgent - Abstract base class for all specialized agents.
 * Every agent must extend this and implement the `analyze` method.
 */
export class BaseAgent {
  constructor(name, description) {
    if (new.target === BaseAgent) {
      throw new Error('BaseAgent is abstract and cannot be instantiated directly');
    }
    this.name = name;
    this.description = description;
    this.startTime = null;
    this.endTime = null;
  }

  async run(state, config = {}) {
    this.startTime = Date.now();
    console.log(`\n[${'='.repeat(50)}]`);
    console.log(`[AGENT] ${this.name} starting...`);
    console.log(`[DESC]  ${this.description}`);
    console.log(`[${'='.repeat(50)}]\n`);

    try {
      const result = await this.analyze(state, config);
      this.endTime = Date.now();

      const agentResult = {
        agent: this.name,
        description: this.description,
        durationMs: this.endTime - this.startTime,
        findingsCount: state.getFindingsByAgent(this.name).length,
        summary: result?.summary || 'Completed',
        ...result,
      };

      state.setAgentResult(this.name, agentResult);

      console.log(`\n[AGENT] ${this.name} completed in ${agentResult.durationMs}ms`);
      console.log(`[AGENT] Findings: ${agentResult.findingsCount}\n`);

      return agentResult;
    } catch (error) {
      this.endTime = Date.now();
      console.error(`[AGENT] ${this.name} FAILED: ${error.message}`);
      state.setAgentResult(this.name, {
        agent: this.name,
        error: error.message,
        durationMs: this.endTime - this.startTime,
      });
      throw error;
    }
  }

  /**
   * Abstract method - must be implemented by each specialized agent.
   * @param {AgentState} state - Shared agent state
   * @param {object} config - Agent-specific configuration
   * @returns {object} Analysis result
   */
  async analyze(state, config) {
    throw new Error(`${this.name} must implement the analyze() method`);
  }

  /**
   * Helper to add a finding to state with this agent's name.
   */
  addFinding(state, { severity, category, title, description, file, line, suggestion, fixable = false }) {
    return state.addFinding({
      agent: this.name,
      severity, // 'critical' | 'high' | 'medium' | 'low' | 'info'
      category, // 'bug' | 'security' | 'performance' | 'architecture' | 'concurrency' | 'missing-feature'
      title,
      description,
      file,
      line,
      suggestion,
      fixable,
    });
  }
}
