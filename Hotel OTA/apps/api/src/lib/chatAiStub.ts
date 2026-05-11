// ── @rez/chat-ai Stub ─────────────────────────────────────────────────────────────
// Local stub implementation for build compatibility (AI chat optional feature)

export type AppType = 'hotel' | 'restaurant' | 'retail' | 'support' | 'general' | 'hotel_ota';
export type ReZAppType = AppType;
export type IndustryCategory = 'TRAVEL' | 'DINING' | 'RETAIL' | 'HOTEL_SERVICE' | 'GENERAL';

export interface KnowledgeEntry {
  id: string;
  type: string;
  title: string;
  content: string;
  tags?: string[];
}

export interface KnowledgeBase {
  entries: KnowledgeEntry[];
  lastUpdated?: Date;
}

export interface CustomerContext {
  userId?: string;
  appType?: AppType;
  hotelId?: string;
  bookingId?: string;
  sessionId?: string;
  name?: string;
  tier?: string;
  merchantId?: string;
  metadata?: Record<string, unknown>;
}

export interface OrderSummary {
  id: string;
  total: number;
  status: string;
  items?: unknown[];
}

export interface BookingSummary {
  id: string;
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
}

export interface AIChatMessage {
  id: string;
  conversationId?: string;
  role?: 'user' | 'assistant' | 'system' | 'ai' | 'staff';
  sender?: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AIChatRequest {
  message: string;
  context: CustomerContext;
  sessionId?: string;
  history?: AIChatMessage[];
}

export interface AIChatResponse {
  message: string;
  actions?: AIAction[];
  suggestions?: string[];
  confidence?: number;
  knowledgeUsed?: boolean;
}

export interface AIAction {
  type: string;
  data: Record<string, unknown>;
  reason: string;
  description?: string;
}

export type ToolHandler<T = unknown> = (params: T, context: CustomerContext) => Promise<ToolResult>;
export type ToolResult = { success: boolean; data?: unknown; error?: string };

export interface KnowledgeProvider {
  getKnowledge(context: CustomerContext): Promise<KnowledgeEntry[]>;
}

export interface Sanitizer {
  sanitize(data: unknown): unknown;
}

export interface ChatSession {
  id: string;
  context: CustomerContext;
  messages: AIChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
}

export interface AIChatService {
  chat(request: AIChatRequest): Promise<AIChatResponse>;
  processMessage(request: {
    conversationId: string;
    message: string;
    userId: string;
    appType: AppType;
    merchantId?: string;
    customerContext?: CustomerContext;
    chatHistory?: AIChatMessage[];
  }): Promise<AIChatResponse>;
  createSession(context: CustomerContext): Promise<ChatSession>;
  getSession(sessionId: string): Promise<ChatSession | null>;
}

export interface AIChatServiceConfig extends ChatConfig {
  knowledgeProvider?: KnowledgeProvider;
  enableAutoReply?: boolean;
  enableSuggestions?: boolean;
  enableToolUse?: boolean;
  maxSuggestions?: number;
  merchantId?: string;
  appType?: AppType;
  industryCategory?: IndustryCategory;
}

export interface ChatContext extends CustomerContext {
  sessionId?: string;
}

export class StubAIChatService implements AIChatService {
  private config: AIChatServiceConfig;

  constructor(config: AIChatServiceConfig) {
    this.config = config;
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    return {
      message: 'AI chat service is not fully configured. Please contact support.',
      confidence: 0,
    };
  }

  async processMessage(request: {
    conversationId: string;
    message: string;
    userId: string;
    appType: AppType;
    merchantId?: string;
    customerContext?: CustomerContext;
    chatHistory?: AIChatMessage[];
  }): Promise<AIChatResponse> {
    // Stub implementation - return a helpful default response
    return {
      message: this.getDefaultResponse(request.message),
      confidence: 0.5,
      suggestions: ['Contact front desk', 'Room service menu', 'Concierge help'],
    };
  }

  private getDefaultResponse(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('check') && lower.includes('in')) {
      return "Our standard check-in time is 2:00 PM. For early check-in, please contact the front desk.";
    }
    if (lower.includes('wifi') || lower.includes('password')) {
      return "Our WiFi network is 'HotelGuest' and the password is available at the front desk.";
    }
    if (lower.includes('restaurant') || lower.includes('food') || lower.includes('dining')) {
      return "Our restaurant is open from 7:00 AM to 10:30 PM. Room service is available 24/7.";
    }
    if (lower.includes('pool') || lower.includes('gym') || lower.includes('spa')) {
      return "The pool is open from 6:00 AM to 10:00 PM. Gym access is available 24/7 with your room key.";
    }
    if (lower.includes('checkout')) {
      return "Standard check-out time is 11:00 AM. Late checkout may be available upon request.";
    }
    return "I'm here to help! For specific assistance, please contact our front desk at extension 0.";
  }

  async createSession(context: CustomerContext): Promise<ChatSession> {
    return {
      id: crypto.randomUUID(),
      context,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    return null;
  }
}

export function createAIChatService(config: AIChatServiceConfig): AIChatService {
  return new StubAIChatService(config);
}

export function sanitizeCustomerContext(context: CustomerContext): CustomerContext {
  return context;
}

// Knowledge Providers stubs
export class GlobalKnowledgeProvider {
  async getKnowledge(context: CustomerContext): Promise<KnowledgeEntry[]> {
    return [];
  }
}

export class AppKnowledgeProvider {
  async getKnowledge(context: CustomerContext): Promise<KnowledgeEntry[]> {
    return [];
  }
}

export class IndustryKnowledgeProvider {
  async getKnowledge(context: CustomerContext): Promise<KnowledgeEntry[]> {
    return [];
  }
}

export class MerchantKnowledgeProvider {
  async getKnowledge(context: CustomerContext): Promise<KnowledgeEntry[]> {
    return [];
  }
}

export class CustomerKnowledgeProvider {
  async getKnowledge(context: CustomerContext): Promise<KnowledgeEntry[]> {
    return [];
  }
}

export class UnifiedKnowledgeBase {
  async getKnowledge(context: CustomerContext): Promise<KnowledgeEntry[]> {
    return [];
  }
}

export async function createKnowledgeBase(): Promise<UnifiedKnowledgeBase> {
  return new UnifiedKnowledgeBase();
}

export async function getKnowledgeForIndustry(industry: IndustryCategory): Promise<KnowledgeEntry[]> {
  return [];
}

export async function getKnowledgeForAppType(appType: AppType): Promise<KnowledgeEntry[]> {
  return [];
}

export const INDUSTRY_CATEGORIES: Record<IndustryCategory, string> = {
  TRAVEL: 'Travel & Hospitality',
  DINING: 'Food & Dining',
  RETAIL: 'Retail',
  HOTEL_SERVICE: 'Hotel Services',
  GENERAL: 'General Support',
};

export interface MerchantKnowledgeData {
  id?: string;
  merchantId?: string;
  type?: string;
  title?: string;
  content?: string;
  tags?: string[];
}

// AI Handler stubs
export interface AIHandlerConfig extends ChatConfig {
  knowledgeProvider?: KnowledgeProvider;
}

export interface ToolHandlerConfig {
  name: string;
  description?: string;
  handler: ToolHandler;
}

export const BOOKING_TOOLS: ToolHandlerConfig[] = [];

export class AIChatHandler {
  constructor(config: AIHandlerConfig) {}
  async handle(request: AIChatRequest): Promise<AIChatResponse> {
    return { message: 'AI handler not configured', confidence: 0 };
  }
}

export async function createAIHandler(config: AIHandlerConfig): Promise<AIChatHandler> {
  return new AIChatHandler(config);
}

// Analytics stubs
export class LearningSystem {
  async recordOutcome(outcome: unknown): Promise<void> {}
  async getPatterns(): Promise<unknown[]> { return []; }
}

export function getLearningSystem(): LearningSystem {
  return new LearningSystem();
}

export function resetLearningSystem(): void {}

export class PatternAnalyzer {
  async analyze(messages: AIChatMessage[]): Promise<unknown[]> { return []; }
}

export class KnowledgeGapDetector {
  async detect(messages: AIChatMessage[]): Promise<unknown[]> { return []; }
}

export class ResponseQualityAnalyzer {
  async analyze(messages: AIChatMessage[]): Promise<unknown> { return {}; }
}

export class ImprovementRecommender {
  async recommend(messages: AIChatMessage[]): Promise<unknown[]> { return []; }
}

export class ConversationOutcomeTracker {
  async track(outcome: unknown): Promise<void> {}
}

export class AnalyticsService {
  async track(event: string, data: unknown): Promise<void> {}
  async getSummary(): Promise<unknown> { return {}; }
}

export function getAnalyticsService(): AnalyticsService {
  return new AnalyticsService();
}

export function resetAnalyticsService(): void {}

export class AnalyticsEventTracker {
  async track(event: string, data: unknown): Promise<void> {}
  async trackOutcome(conversationId: string, outcome: unknown): Promise<void> {}
}

export async function detectIntent(message: string): Promise<unknown> {
  return { intent: 'unknown', confidence: 0 };
}

export interface AnalyticsRepository {
  save(event: unknown): Promise<void>;
  query(filter: unknown): Promise<unknown[]>;
}

// Sanitizers
export function sensitiveDataSanitizer(data: unknown): unknown {
  return data;
}

export function cardNumberSanitizer(data: unknown): unknown {
  return data;
}

export function emailSanitizer(data: unknown): unknown {
  return data;
}

export function phoneSanitizer(data: unknown): unknown {
  return data;
}

export function idSanitizer(data: unknown): unknown {
  return data;
}

export function transactionSanitizer(data: unknown): unknown {
  return data;
}

export class DataSanitizer {
  sanitize(data: unknown): unknown { return data; }
}

export const defaultSanitizer = new DataSanitizer();

export interface SanitizedCustomerContext extends CustomerContext {}

// Analytics types
export type ConversationOutcome = 'resolved' | 'transferred' | 'abandoned' | 'escalated';

export interface MessageFeedback {
  messageId: string;
  rating?: number;
  helpful?: boolean;
  feedback?: string;
}

export interface AIResponseMetrics {
  responseTimeMs: number;
  tokensUsed?: number;
  confidence?: number;
}

export interface PatternEntry {
  pattern: string;
  count: number;
  lastSeen: Date;
}

export interface KnowledgeGap {
  topic: string;
  frequency: number;
  suggestedContent?: string;
}

export interface ImprovementAction {
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

export interface AnalyticsSummary {
  totalConversations: number;
  resolvedCount: number;
  transferredCount: number;
  averageResponseTimeMs: number;
  topIntents: PatternEntry[];
}

export interface AnalyticsEvents {
  conversation_started: unknown;
  message_sent: unknown;
  message_received: unknown;
  action_executed: unknown;
  conversation_ended: unknown;
  outcome_recorded: unknown;
}

import * as crypto from 'crypto';
