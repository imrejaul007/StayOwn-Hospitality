import { BaseAgent } from '../core/BaseAgent.js';

/**
 * ConcurrencyAgent - Detects race conditions, missing transactions, and locking issues.
 * Critical for PMS systems handling bookings, payments, and inventory.
 */
export class ConcurrencyAgent extends BaseAgent {
  constructor() {
    super('ConcurrencyAgent', 'Detects race conditions, missing DB transactions, and concurrent access issues in booking/payment flows');
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

      this._checkReadModifyWrite(state, content, file);
      this._checkMissingTransactions(state, content, file);
      this._checkDoubleBooking(state, content, file);
      this._checkInventoryRace(state, content, file);
      this._checkPaymentRace(state, content, file);
      this._checkCounterIncrement(state, content, file);
      this._checkStatusTransition(state, content, file);
    }

    return {
      summary: `Concurrency analysis complete across ${allFiles.length} files`,
      filesAnalyzed: allFiles.length,
    };
  }

  _checkReadModifyWrite(state, content, file) {
    // Skip service files — controllers are the entry points where RMW matters
    if (file.relativePath.includes('service')) return;
    // Skip files already using transactions or atomic operations
    if (/withTransaction|atomicStatusTransition/.test(content)) return;
    // Also skip files that predominantly use atomic operations
    const atomicOps = (content.match(/findOneAndUpdate|findByIdAndUpdate|\$inc|\$set|\$push|\$pull/g) || []).length;
    const saveOps = (content.match(/\.save\s*\(\s*\)/g) || []).length;
    if (atomicOps > saveOps * 2) return; // File uses atomic ops more than saves

    // Classic read-modify-write without atomic operations
    // Pattern: read document → modify in JS → save back
    const rmwPattern = /(?:const|let|var)\s+(\w+)\s*=\s*await\s+\w+\.find(?:One|ById)\s*\([^)]+\)[\s\S]{1,500}?\1\.\w+\s*(?:=|\+=|-=)[\s\S]{1,300}?\1\.save\s*\(\s*\)/g;

    let match;
    while ((match = rmwPattern.exec(content))) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const snippet = match[0].substring(0, 100);

      // Check if it's wrapped in a transaction/session
      const surroundingCode = content.substring(
        Math.max(0, match.index - 500),
        Math.min(content.length, match.index + match[0].length + 200)
      );
      const hasTransaction = /session|transaction|startSession|withTransaction/.test(surroundingCode);
      const hasAtomicOp = /\$inc|\$set.*\$where|\$atomic/.test(surroundingCode);

      if (!hasTransaction && !hasAtomicOp) {
        // Check if this is a critical operation (booking, payment, inventory)
        const isCritical = /book|reserv|payment|pay|inventory|balance|stock|count|quantity/i.test(match[0]);
        const severity = isCritical ? 'critical' : 'medium';

        this.addFinding(state, {
          severity,
          category: 'concurrency',
          title: `Read-modify-write race condition${isCritical ? ' in critical operation' : ''}`,
          description: `At line ${lineNum} in ${file.relativePath}: A document is read, modified in JavaScript, and saved back without atomic operations or a transaction. If two requests execute concurrently, one update will be lost.\n\nPattern detected: find → modify → save`,
          file: file.relativePath,
          line: lineNum,
          suggestion: isCritical
            ? 'Use MongoDB atomic operators ($inc, $set) or wrap in a session/transaction with optimistic concurrency control (version field).'
            : 'Consider using atomic operators or transactions for this operation.',
          fixable: true,
        });
      }
    }
  }

  _checkMissingTransactions(state, content, file) {
    // Multiple write operations that should be atomic
    const multiWritePattern = /(?:await\s+\w+\.(?:create|save|update|delete|remove|findOneAndUpdate)\s*\([^)]*\)[\s\S]{1,300}?){2,}/g;

    let match;
    while ((match = multiWritePattern.exec(content))) {
      const surroundingCode = content.substring(
        Math.max(0, match.index - 300),
        Math.min(content.length, match.index + match[0].length + 200)
      );

      const hasTransaction = /session|transaction|startSession|withTransaction/.test(surroundingCode);

      if (!hasTransaction) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        const isCritical = /book|payment|transfer|checkout|refund|billing/i.test(surroundingCode);

        if (isCritical) {
          this.addFinding(state, {
            severity: 'high',
            category: 'concurrency',
            title: 'Multiple writes without transaction in critical operation',
            description: `At line ${lineNum} in ${file.relativePath}: Multiple database write operations are performed without a MongoDB transaction. If any operation fails, the database will be left in an inconsistent state (partial update).`,
            file: file.relativePath,
            line: lineNum,
            suggestion: 'Wrap related write operations in a MongoDB session/transaction: const session = await mongoose.startSession(); await session.withTransaction(async () => { ... });',
            fixable: true,
          });
        }
      }
    }
  }

  _checkDoubleBooking(state, content, file) {
    if (!/book|reserv/i.test(file.name) && !/book|reserv/i.test(content)) return;
    // Skip files already using transactions
    if (/withTransaction|session\.withTransaction|startSession/.test(content)) return;
    // Skip if the file already uses findOneAndUpdate with availability preconditions
    if (/findOneAndUpdate[\s\S]{0,200}available|findOneAndUpdate[\s\S]{0,200}status/.test(content)) return;

    // Check for availability check followed by booking creation without lock
    // Only match when both patterns appear within 500 chars (same function)
    const checkThenBook = /(?:availability|available|isAvailable|checkAvailability)[\s\S]{1,500}?(?:\.create|\.save|new\s+\w*[Bb]ooking)/g;

    let match;
    while ((match = checkThenBook.exec(content))) {
      const surroundingCode = content.substring(
        Math.max(0, match.index - 300),
        match.index + match[0].length + 200
      );

      const hasLocking = /lock|mutex|semaphore|session|transaction|\$atomic|findOneAndUpdate/.test(surroundingCode);

      if (!hasLocking) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        this.addFinding(state, {
          severity: 'critical',
          category: 'concurrency',
          title: 'Double booking vulnerability — check-then-act race condition',
          description: `At line ${lineNum} in ${file.relativePath}: Availability is checked and then a booking is created in separate operations without locking. Two concurrent requests for the same room/time can both pass the availability check and both create bookings (TOCTOU race condition).\n\nThis is the #1 concurrency bug in booking systems.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Use one of:\n1. MongoDB findOneAndUpdate with conditions: findOneAndUpdate({ roomId, date, status: "available" }, { $set: { status: "booked" } })\n2. Unique compound index on (roomId, date) to prevent duplicates at DB level\n3. Pessimistic locking with a distributed lock (Redis SETNX)\n4. Optimistic concurrency with a version field',
          fixable: true,
        });
      }
    }
  }

  _checkInventoryRace(state, content, file) {
    if (!/inventor|stock|quantity|supply/i.test(content)) return;

    // Check for non-atomic inventory decrements
    const inventoryDecrement = /(?:quantity|stock|count|inventory)\s*(?:-=|-\s*=|=\s*\w+\s*-)/g;

    let match;
    while ((match = inventoryDecrement.exec(content))) {
      const surroundingCode = content.substring(
        Math.max(0, match.index - 500),
        match.index + 200
      );

      const hasAtomic = /\$inc|\$atomic|findOneAndUpdate|updateOne|transaction|session/.test(surroundingCode);

      if (!hasAtomic) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        this.addFinding(state, {
          severity: 'high',
          category: 'concurrency',
          title: 'Non-atomic inventory update — race condition',
          description: `At line ${lineNum} in ${file.relativePath}: Inventory/stock quantity is decremented using JavaScript arithmetic instead of atomic database operations. Concurrent purchases can oversell inventory.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Use atomic MongoDB operations: updateOne({ _id, quantity: { $gte: amount } }, { $inc: { quantity: -amount } }). The $gte condition prevents negative stock.',
          fixable: true,
        });
      }
    }
  }

  _checkPaymentRace(state, content, file) {
    if (!/pay|charge|refund|billing|invoice|settlement/i.test(file.name)) return;

    // Payment status updates without idempotency
    const paymentUpdate = /(?:status|paymentStatus)\s*=\s*['"](?:paid|completed|refunded|settled)['"]/g;

    let match;
    while ((match = paymentUpdate.exec(content))) {
      const surroundingCode = content.substring(
        Math.max(0, match.index - 800),
        match.index + 500
      );

      const hasIdempotency = /idempotency|idempotent|nonce|requestId|already.*paid|status.*!==/.test(surroundingCode);
      const hasTransaction = /session|transaction/.test(surroundingCode);

      if (!hasIdempotency && !hasTransaction) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        this.addFinding(state, {
          severity: 'high',
          category: 'concurrency',
          title: 'Payment status update without idempotency check',
          description: `At line ${lineNum} in ${file.relativePath}: Payment status is updated without checking if it was already processed. Duplicate webhooks or retried requests could process the same payment twice.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Add idempotency: check current status before updating, use idempotency keys, and wrap in a transaction.',
          fixable: true,
        });
      }
    }
  }

  _checkCounterIncrement(state, content, file) {
    // Non-atomic counter increments (e.g., booking numbers, invoice numbers)
    const counterPattern = /(?:counter|sequence|number|nextId)\s*(?:\+\+|=\s*\w+\s*\+\s*1|\+=\s*1)/gi;

    let match;
    while ((match = counterPattern.exec(content))) {
      const surroundingCode = content.substring(
        Math.max(0, match.index - 300),
        match.index + 200
      );

      const hasAtomic = /\$inc|findOneAndUpdate|atomic|findAndModify/.test(surroundingCode);
      if (!hasAtomic) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        this.addFinding(state, {
          severity: 'medium',
          category: 'concurrency',
          title: 'Non-atomic counter increment — may produce duplicates',
          description: `At line ${lineNum} in ${file.relativePath}: A counter/sequence is incremented non-atomically. Concurrent requests can read the same value and produce duplicate sequence numbers.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Use findOneAndUpdate with $inc for atomic counter increments.',
          fixable: true,
        });
      }
    }
  }

  _checkStatusTransition(state, content, file) {
    // Status transitions without checking current state
    const statusUpdate = /(?:\.status|\.bookingStatus|\.paymentStatus)\s*=\s*['"]\w+['"]/g;

    let match;
    let uncheckedTransitions = 0;
    while ((match = statusUpdate.exec(content))) {
      const before = content.substring(Math.max(0, match.index - 300), match.index);
      const hasStatusCheck = /if\s*\([^)]*status\s*(?:===|!==|==|!=)/.test(before);

      if (!hasStatusCheck) {
        uncheckedTransitions++;
      }
    }

    if (uncheckedTransitions > 2) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'concurrency',
        title: `${uncheckedTransitions} status transitions without state validation`,
        description: `${file.relativePath} has ${uncheckedTransitions} status updates that don't check the current status first. This allows invalid state transitions (e.g., "cancelled" → "checked_in") and race conditions where concurrent requests both succeed.`,
        file: file.relativePath,
        suggestion: 'Always validate current status before transitioning. Use findOneAndUpdate with a status condition: { status: "confirmed" } as a precondition.',
        fixable: true,
      });
    }
  }
}
