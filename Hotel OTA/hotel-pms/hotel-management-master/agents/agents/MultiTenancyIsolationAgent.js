import { BaseAgent } from '../core/BaseAgent.js';

/**
 * MultiTenancyIsolationAgent - Detects tenant data leakage and missing property isolation.
 *
 * In a multi-property hotel system, EVERY query that returns tenant-specific data
 * must filter by hotelId/propertyId. Missing filters = data leakage between hotels.
 * This is a PM-critical issue: Hotel A's staff seeing Hotel B's bookings/financials.
 */
export class MultiTenancyIsolationAgent extends BaseAgent {
  constructor() {
    super('MultiTenancyIsolationAgent', 'Detects missing tenant isolation, cross-property data leakage, and hotelId filter gaps');
  }

  async analyze(state, config) {
    const { scanner } = config;
    const allFiles = [
      ...(state.context.files.controllers || []),
      ...(state.context.files.services || []),
      ...(state.context.files.routes || []),
    ];

    const tenantSensitiveModels = [
      'Booking', 'Room', 'RoomType', 'Payment', 'Invoice', 'Guest', 'Housekeeping',
      'HousekeepingTask', 'MaintenanceTask', 'Inventory', 'InventoryItem', 'StaffTask',
      'Settlement', 'POSOrder', 'LaundryTransaction', 'DigitalKey', 'DayUseBooking',
      'RoomBlock', 'RoomAvailability', 'BillingSession', 'Notification', 'Communication',
      'IncidentReport', 'LostFound', 'CheckoutInventory', 'DailyRoutineCheck',
      'GeneralLedger', 'JournalEntry', 'FinancialInvoice', 'FinancialPayment',
    ];

    let queriesWithoutHotelId = 0;
    let bulkOpsWithoutTenantFilter = 0;
    let adminEndpointsWithLeakage = 0;

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      // 1. Check queries on tenant-sensitive models that miss hotelId filter
      this._checkMissingTenantFilter(state, content, file, tenantSensitiveModels);

      // 2. Check aggregate pipelines without $match on hotelId
      this._checkAggregateLeakage(state, content, file);

      // 3. Check bulk operations (update/delete many) without tenant scope
      this._checkBulkOperationScope(state, content, file);

      // 4. Check list endpoints without tenant filtering
      this._checkListEndpoints(state, content, file);

      // 5. Check cross-property access in controllers
      this._checkCrossPropertyAccess(state, content, file);

      // 6. Check for propertyAccess middleware usage
      this._checkPropertyAccessMiddleware(state, content, file);

      // 7. Check Redis/cache keys for tenant isolation
      this._checkCacheIsolation(state, content, file);

      // 8. Check WebSocket event broadcasting scope
      this._checkWebSocketScope(state, content, file);
    }

    // 9. Check models for hotelId field
    this._checkModelTenantField(state, tenantSensitiveModels);

    return {
      summary: `Multi-tenancy audit complete across ${allFiles.length} files`,
      filesAnalyzed: allFiles.length,
    };
  }

  _checkMissingTenantFilter(state, content, file, tenantModels) {
    // Skip files that import tenant isolation middleware (hotelId is injected at route level)
    if (/ensureTenantContext|tenantFilter|tenantIsolation|req\.tenantId/.test(content)) return;
    // Skip files that use ensurePropertyAccess (also provides tenant scoping)
    if (/ensurePropertyAccess|propertyAccess/.test(content)) return;
    // Skip services that receive hotelId as parameter (passed from tenant-scoped controllers)
    if (file.relativePath.includes('service') && /hotelId|hotel_id|tenantId/.test(content)) return;
    // Skip files that consistently use hotelId in their queries (>3 occurrences = tenant-aware)
    const hotelIdUsage = (content.match(/hotelId|hotel\._id|req\.user\.hotel/g) || []).length;
    if (hotelIdUsage >= 3) return;

    for (const model of tenantModels) {
      // Find queries on this model without hotelId filter
      const patterns = [
        new RegExp(`${model}\\.find\\s*\\(\\s*\\{(?![^}]*hotel)`, 'g'),
        new RegExp(`${model}\\.findOne\\s*\\(\\s*\\{(?![^}]*hotel)`, 'g'),
        new RegExp(`${model}\\.findById`, 'g'),
        new RegExp(`${model}\\.aggregate\\s*\\(\\s*\\[\\s*\\{\\s*\\$(?!match[\\s\\S]*hotel)`, 'g'),
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content))) {
          // Check surrounding context for hotelId
          const surrounding = content.substring(
            Math.max(0, match.index - 200),
            Math.min(content.length, match.index + match[0].length + 300)
          );

          const hasTenantFilter = /hotelId|hotel\._id|req\.user\.hotel|req\.hotel|propertyId/.test(surrounding);
          if (!hasTenantFilter) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            this.addFinding(state, {
              severity: 'critical',
              category: 'multi-tenancy',
              title: `Tenant data leakage: ${model} query without hotelId filter`,
              description: `At line ${lineNum} in ${file.relativePath}: A query on "${model}" does not filter by hotelId. In a multi-property setup, this returns data from ALL hotels, causing cross-tenant data exposure. Hotel A staff can see Hotel B's ${model.toLowerCase()} records.`,
              file: file.relativePath,
              line: lineNum,
              suggestion: `Add hotelId filter: ${model}.find({ hotelId: req.user.hotelId, ...otherFilters }). Use middleware to inject tenant context automatically.`,
              fixable: true,
            });
            break; // One finding per model per file
          }
        }
      }
    }
  }

  _checkAggregateLeakage(state, content, file) {
    // Skip if tenant isolation is applied at any level
    if (/ensureTenantContext|tenantFilter|tenantIsolation|req\.tenantId|ensurePropertyAccess/.test(content)) return;
    if (file.relativePath.includes('service') && /hotelId/.test(content)) return;
    const hotelIdUsage = (content.match(/hotelId|hotel\._id/g) || []).length;
    if (hotelIdUsage >= 3) return;

    const aggWithoutMatch = /\.aggregate\s*\(\s*\[\s*(?!\s*\{\s*\$match[\s\S]{0,100}hotel)/g;
    let match;
    while ((match = aggWithoutMatch.exec(content))) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const surrounding = content.substring(match.index, match.index + 500);
      if (!/hotelId|hotel/.test(surrounding.substring(0, 200))) {
        this.addFinding(state, {
          severity: 'high',
          category: 'multi-tenancy',
          title: 'Aggregation pipeline without tenant $match',
          description: `At line ${lineNum} in ${file.relativePath}: Aggregation pipeline does not start with a $match on hotelId. This computes analytics/reports across ALL hotels' data, leaking business intelligence between tenants.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Always start aggregation with: { $match: { hotelId } } as the first stage.',
          fixable: true,
        });
        break;
      }
    }
  }

  _checkBulkOperationScope(state, content, file) {
    // Skip if tenant isolation is applied at any level
    if (/ensureTenantContext|tenantFilter|tenantIsolation|req\.tenantId|ensurePropertyAccess|requireTenantInBulkOps/.test(content)) return;
    if (file.relativePath.includes('service') && /hotelId/.test(content)) return;
    const hotelIdUsage = (content.match(/hotelId/g) || []).length;
    if (hotelIdUsage >= 3) return;

    const bulkOps = [
      { regex: /\.updateMany\s*\(\s*\{(?![^}]*hotel)/g, op: 'updateMany' },
      { regex: /\.deleteMany\s*\(\s*\{(?![^}]*hotel)/g, op: 'deleteMany' },
      { regex: /\.insertMany\s*\(/g, op: 'insertMany' },
    ];

    for (const { regex, op } of bulkOps) {
      let match;
      while ((match = regex.exec(content))) {
        const surrounding = content.substring(
          Math.max(0, match.index - 100),
          match.index + 200
        );
        if (!/hotelId|hotel/.test(surrounding)) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          this.addFinding(state, {
            severity: 'critical',
            category: 'multi-tenancy',
            title: `Bulk ${op} without tenant scope`,
            description: `At line ${lineNum} in ${file.relativePath}: Bulk operation "${op}" does not scope by hotelId. This affects ALL tenants' data — a deleteMany without hotelId could wipe records across all hotels.`,
            file: file.relativePath,
            line: lineNum,
            suggestion: `Always include hotelId in bulk operations: .${op}({ hotelId, ...conditions })`,
            fixable: true,
          });
          break;
        }
      }
    }
  }

  _checkListEndpoints(state, content, file) {
    if (!file.relativePath.includes('route') && !file.relativePath.includes('controller')) return;

    // GET list endpoints that return find() without hotelId
    const listPattern = /router\.get\s*\(\s*['"]\/['"][^)]*\)\s*[\s\S]*?\.find\s*\(\s*\{?\s*\}?\s*\)/g;
    let match;
    while ((match = listPattern.exec(content))) {
      const surrounding = content.substring(match.index, match.index + 500);
      if (!/hotelId|hotel|req\.user\.hotel/.test(surrounding)) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        this.addFinding(state, {
          severity: 'high',
          category: 'multi-tenancy',
          title: 'List endpoint may return cross-tenant data',
          description: `${file.relativePath} has a GET list endpoint that queries without tenant filtering. Users may see records from other hotels.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Inject hotelId from authenticated user context into all list queries.',
          fixable: true,
        });
        break;
      }
    }
  }

  _checkCrossPropertyAccess(state, content, file) {
    // Check if controllers accept hotelId from request body (client-controlled) instead of session
    const clientControlledHotel = /(?:req\.body\.hotelId|req\.query\.hotelId|req\.params\.hotelId)(?![\s\S]*verify|[\s\S]*validate|[\s\S]*authorize)/g;
    if (clientControlledHotel.test(content)) {
      const hasVerification = /propertyAccess|verifyHotel|ensureProperty|checkHotel/.test(content);
      if (!hasVerification) {
        this.addFinding(state, {
          severity: 'high',
          category: 'multi-tenancy',
          title: 'Client-controlled hotelId without verification',
          description: `${file.relativePath} reads hotelId from client request (body/query/params) without verifying the user has access to that property. A user at Hotel A could pass Hotel B's ID to access their data.`,
          file: file.relativePath,
          suggestion: 'Always verify hotelId against req.user.hotelId or user\'s allowed properties. Never trust client-provided hotelId.',
          fixable: true,
        });
      }
    }
  }

  _checkPropertyAccessMiddleware(state, content, file) {
    if (!file.relativePath.includes('route')) return;

    // Routes with tenant-sensitive operations but no propertyAccess middleware
    const hasTenantOps = /Booking|Room|Payment|Invoice|Housekeeping|Inventory|Guest/i.test(content);
    const hasPropertyMiddleware = /propertyAccess|ensureProperty|multiTenant|hotelMiddleware/.test(content);

    if (hasTenantOps && !hasPropertyMiddleware) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'multi-tenancy',
        title: `Route missing property access middleware: ${file.name}`,
        description: `${file.relativePath} handles tenant-sensitive resources but doesn't use property access middleware to ensure users can only access their property's data.`,
        file: file.relativePath,
        suggestion: 'Add propertyAccess or ensurePropertyAccess middleware to all tenant-scoped routes.',
        fixable: true,
      });
    }
  }

  _checkCacheIsolation(state, content, file) {
    // Redis cache keys without tenant prefix
    const cacheOps = /(?:redis|cache)\.(?:get|set|del)\s*\(\s*['"`](?!.*hotel)(?!.*tenant)(?!.*property)/gi;
    if (cacheOps.test(content)) {
      const hasTenantKey = /hotelId|tenantId|propertyId/.test(
        content.substring(0, content.search(cacheOps) + 200)
      );
      if (!hasTenantKey) {
        this.addFinding(state, {
          severity: 'high',
          category: 'multi-tenancy',
          title: 'Cache key without tenant prefix',
          description: `${file.relativePath} uses Redis/cache operations without including tenant ID in the key. Hotel A and Hotel B may read each other's cached data.`,
          file: file.relativePath,
          suggestion: 'Prefix all cache keys with tenant ID: `hotel:${hotelId}:resourceType:${resourceId}`',
          fixable: true,
        });
      }
    }
  }

  _checkWebSocketScope(state, content, file) {
    // Broadcasting events without room/channel scoping by hotel
    if (/io\.emit|socket\.broadcast|\.emit\s*\(/.test(content)) {
      const hasScopedEmit = /\.to\s*\(|\.in\s*\(|hotel|room\s*\(/.test(content);
      if (!hasScopedEmit && /notif|booking|update|alert/i.test(content)) {
        this.addFinding(state, {
          severity: 'high',
          category: 'multi-tenancy',
          title: 'WebSocket broadcast without tenant scoping',
          description: `${file.relativePath} broadcasts WebSocket events without scoping to a hotel/property room. All connected users across all hotels will receive each other's real-time updates (bookings, alerts, etc.).`,
          file: file.relativePath,
          suggestion: 'Use Socket.io rooms: socket.join(`hotel:${hotelId}`). Emit to room: io.to(`hotel:${hotelId}`).emit(event, data).',
          fixable: true,
        });
      }
    }
  }

  _checkModelTenantField(state, tenantModels) {
    for (const modelName of tenantModels) {
      const modelInfo = state.context.models.get(modelName);
      if (!modelInfo) continue;

      const hasHotelField = modelInfo.fields.some(
        (f) => f.name === 'hotelId' || f.name === 'hotel' || f.name === 'property'
      );

      if (!hasHotelField) {
        this.addFinding(state, {
          severity: 'high',
          category: 'multi-tenancy',
          title: `Model "${modelName}" missing hotelId field`,
          description: `The "${modelName}" model does not have a hotelId/hotel field. Without this field, there is no way to enforce tenant isolation at the data layer — all records are global.`,
          file: modelInfo.file,
          suggestion: `Add "hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true }" to the schema.`,
          fixable: true,
        });
      }
    }
  }
}
