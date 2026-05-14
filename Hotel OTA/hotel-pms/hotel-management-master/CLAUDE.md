# Hotel Management System (PMS) — CLAUDE.md

---

## Service Discovery

This service is registered in REZ-Master/services.json.

To discover related services:
```bash
# From REZ-Master directory
node rez-cli find <service-name>  # Find specific service
node rez-cli list --category <category>  # List by category
node rez-cli stats  # Platform statistics
```

Quick search:
- `node rez-cli list --search payment` - Find payment services
- `node rez-cli list --search auth` - Find auth services
- `node rez-cli list --search kds` - Find KDS services
- `node rez-cli list --search ai` - Find AI services

---



## Project Overview
Enterprise-grade hotel management system. Node.js/Express backend, React/TypeScript frontend, MongoDB, Redis, Stripe payments, Socket.io real-time.

## Architecture
- **Backend:** `backend/src/` — MVC + Service Layer (168 routes, 108 controllers, 164 services, 176 models, 33 middleware)
- **Frontend:** `frontend/src/` — React 18 + TypeScript + Vite + Zustand + TanStack Query (200 pages, 423 components)
- **Tests:** `backend/src/tests/`, `e2e-tests/`, `frontend/src/**/*.test.*`
- **Agent System:** `agents/` — 18-agent autonomous code reviewer

## Code Reviewer Agent System
Located at `agents/`. Run with `node agents/index.js`.

### Available Agents (register as sub-agents when needed):

| Agent | File | Use When |
|-------|------|----------|
| CodebaseAnalyzerAgent | `agents/agents/CodebaseAnalyzerAgent.js` | Need to catalog files, models, routes, services |
| DataFlowAgent | `agents/agents/DataFlowAgent.js` | Tracing request lifecycle, finding broken chains |
| BugDetectionAgent | `agents/agents/BugDetectionAgent.js` | Finding async bugs, null safety, error swallowing |
| SecurityAuditAgent | `agents/agents/SecurityAuditAgent.js` | OWASP Top 10, auth issues, injection, data leakage |
| PerformanceAgent | `agents/agents/PerformanceAgent.js` | N+1 queries, missing indexes, unbounded queries |
| ArchitectureAgent | `agents/agents/ArchitectureAgent.js` | God files, circular deps, layer violations |
| ConcurrencyAgent | `agents/agents/ConcurrencyAgent.js` | Race conditions, missing transactions, double booking |
| BookingSystemAgent | `agents/agents/BookingSystemAgent.js` | Booking workflow, room assignment, rate calc |
| PaymentFlowAgent | `agents/agents/PaymentFlowAgent.js` | Stripe, webhooks, refunds, idempotency |
| MultiTenancyIsolationAgent | `agents/agents/MultiTenancyIsolationAgent.js` | Cross-hotel data leakage, missing hotelId filters |
| HotelOperationsAgent | `agents/agents/HotelOperationsAgent.js` | Housekeeping, maintenance, inventory, laundry |
| ComplianceAgent | `agents/agents/ComplianceAgent.js` | GDPR, PCI-DSS, data retention, audit trails |
| APIDesignAgent | `agents/agents/APIDesignAgent.js` | REST conventions, response consistency, docs |
| TestCoverageAgent | `agents/agents/TestCoverageAgent.js` | Untested critical paths, coverage gaps |
| FrontendQualityAgent | `agents/agents/FrontendQualityAgent.js` | React quality, accessibility, error boundaries |
| ErrorResilienceAgent | `agents/agents/ErrorResilienceAgent.js` | Graceful degradation, circuit breakers, fallbacks |
| BusinessLogicCompletenessAgent | `agents/agents/BusinessLogicCompletenessAgent.js` | Feature completeness, user journeys, KPIs |
| RefactorExecutionAgent | `agents/agents/RefactorExecutionAgent.js` | Fix plan generation, automated refactoring |

### Running Agents
```bash
cd agents
node index.js                      # Full 18-agent review
node index.js --agents=security    # Single agent
node index.js --mode=fix           # Apply auto-fixes
node index.js --parallel           # Parallel within phases
```

### Reports Output
Reports go to `agents/reports/` as JSON + Markdown.

## Important Rules
- **Do NOT commit** unless the user explicitly asks you to commit. Never auto-commit.

## Key Conventions
- Backend uses ESM (`import`/`export`) — NOT CommonJS
- Frontend uses ESM (`import`/`export`)
- MongoDB with Mongoose ODM
- All tenant-scoped queries MUST filter by `hotelId`
- Authentication via JWT (middleware at `backend/src/middleware/auth.js`)
- Roles: admin, manager, frontdesk, staff, housekeeping, guest, travel_agent
- Error handling: `catchAsync` wrapper or `try/catch` in controllers

## Data Fetching — Server-Side Pagination & Protection (MANDATORY)
All list/collection endpoints and queries MUST use server-side pagination, sorting, and filtering so the system stays stable even with 10,000,000+ records. If you find code that fetches unbounded data, **auto-fix it** before moving on.

### Backend Rules
- **Never** use `.find({})` without `.limit()` — always default to `limit=20, maxLimit=100`
- Every list endpoint MUST accept `page`, `limit`, `sort`, `order` query params
- Use `.skip()` and `.limit()` (or cursor-based pagination for large offsets) on all Mongoose queries
- Add `.lean()` for read-only list queries to reduce memory
- Return pagination metadata: `{ data, page, limit, totalCount, totalPages }`
- Use `.countDocuments()` with the same filter for `totalCount`
- For search/filter endpoints, ensure indexes exist on filtered fields

### Frontend Rules
- **Never** fetch all records at once — always pass `page` & `limit` params
- Use TanStack Query with `keepPreviousData: true` for smooth pagination UX
- Implement paginated tables/lists with page controls (next/prev/page number)
- For infinite scroll, use `useInfiniteQuery` with cursor or page-based fetching
- Show loading/skeleton states during page transitions

### Auto-Fix Mandate
When working on any file, if you encounter an unbounded `.find()`, `Model.find({})` without limit, or a frontend fetch that loads all records without pagination — **fix it immediately** by adding proper server-side pagination. Do not leave unbounded queries in the codebase.

## Production Readiness Plan
See `PRODUCTION_READINESS_PLAN.md` for the full 12-week plan with 975 findings across 12 categories.

## Common Commands
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev

# Tests
cd backend && npm test
npm run test:e2e

# Agent System
cd agents && node index.js
```

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes � gives risk-scored analysis |
| `get_review_context` | Need source snippets for review � token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
