import { toast } from '@/utils/toast';
import tapeChartService from '@/services/tapeChartService';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  type: 'validation' | 'approval' | 'assignment' | 'notification' | 'payment' | 'custom';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  assignedTo?: string;
  assignedToRole?: 'staff' | 'admin' | 'manager' | 'finance';
  dueDate?: Date;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
  data?: Record<string, unknown>;
  dependencies?: string[]; // Step IDs that must complete first
  autoExecute?: boolean;
  timeout?: number; // Auto-fail after timeout in minutes
}

export interface ReservationWorkflow {
  id: string;
  reservationId: string;
  workflowType: 'standard' | 'vip' | 'corporate' | 'group' | 'custom';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  currentStep?: string;
  steps: WorkflowStep[];
  reservationData: Record<string, unknown>;
  metadata: {
    guestType: 'individual' | 'corporate' | 'group' | 'vip';
    totalAmount: number;
    roomCount: number;
    specialRequirements: string[];
    approvalRequired: boolean;
    escalationLevel: number;
  };
  notifications: Array<{
    type: 'email' | 'sms' | 'internal';
    recipient: string;
    message: string;
    sentAt: Date;
    status: 'pending' | 'sent' | 'failed';
  }>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  workflowType: string;
  isActive: boolean;
  steps: Omit<WorkflowStep, 'id' | 'status' | 'completedAt' | 'completedBy'>[];
  conditions: {
    guestType?: string[];
    reservationValue?: { min?: number; max?: number };
    roomCount?: { min?: number; max?: number };
    advanceBooking?: { min?: number; max?: number };
    specialRequirements?: string[];
  };
}

export class ReservationWorkflowEngine {
  private static instance: ReservationWorkflowEngine;
  private workflows: Map<string, ReservationWorkflow> = new Map();
  private templates: Map<string, WorkflowTemplate> = new Map();
  private activeSubscriptions: Map<string, (workflow: ReservationWorkflow) => void> = new Map();
  private stepTimeoutTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private constructor() {
    this.initializeDefaultTemplates();
  }

  static getInstance(): ReservationWorkflowEngine {
    if (!ReservationWorkflowEngine.instance) {
      ReservationWorkflowEngine.instance = new ReservationWorkflowEngine();
    }
    return ReservationWorkflowEngine.instance;
  }

  // Template Management
  private initializeDefaultTemplates(): void {
    const standardTemplate: WorkflowTemplate = {
      id: 'standard-reservation',
      name: 'Standard Reservation Workflow',
      description: 'Default workflow for regular reservations',
      workflowType: 'standard',
      isActive: true,
      steps: [
        {
          name: 'Validate Guest Information',
          description: 'Verify guest details and payment information',
          type: 'validation',
          autoExecute: true,
          timeout: 5
        },
        {
          name: 'Room Assignment',
          description: 'Assign appropriate room based on preferences',
          type: 'assignment',
          assignedToRole: 'staff',
          timeout: 60
        },
        {
          name: 'Send Confirmation',
          description: 'Send booking confirmation to guest',
          type: 'notification',
          autoExecute: true,
          dependencies: ['room-assignment']
        }
      ],
      conditions: {
        guestType: ['individual'],
        reservationValue: { max: 50000 }
      }
    };

    const vipTemplate: WorkflowTemplate = {
      id: 'vip-reservation',
      name: 'VIP Guest Workflow',
      description: 'Enhanced workflow for VIP guests',
      workflowType: 'vip',
      isActive: true,
      steps: [
        {
          name: 'VIP Profile Verification',
          description: 'Verify VIP status and preferences',
          type: 'validation',
          assignedToRole: 'manager',
          timeout: 30
        },
        {
          name: 'Premium Room Assignment',
          description: 'Assign best available room with upgrades',
          type: 'assignment',
          assignedToRole: 'manager',
          timeout: 45
        },
        {
          name: 'Special Services Setup',
          description: 'Arrange VIP amenities and services',
          type: 'custom',
          assignedToRole: 'staff',
          timeout: 120
        },
        {
          name: 'Manager Approval',
          description: 'Final approval from manager',
          type: 'approval',
          assignedToRole: 'manager',
          timeout: 240
        },
        {
          name: 'VIP Confirmation Package',
          description: 'Send detailed VIP confirmation with perks',
          type: 'notification',
          autoExecute: true,
          dependencies: ['manager-approval']
        }
      ],
      conditions: {
        guestType: ['vip'],
        reservationValue: { min: 25000 }
      }
    };

    const corporateTemplate: WorkflowTemplate = {
      id: 'corporate-reservation',
      name: 'Corporate Booking Workflow',
      description: 'Workflow for corporate and group bookings',
      workflowType: 'corporate',
      isActive: true,
      steps: [
        {
          name: 'Corporate Account Verification',
          description: 'Verify corporate account and credit terms',
          type: 'validation',
          assignedToRole: 'finance',
          timeout: 60
        },
        {
          name: 'Group Room Blocking',
          description: 'Block rooms for corporate group',
          type: 'assignment',
          assignedToRole: 'staff',
          timeout: 90
        },
        {
          name: 'Corporate Rate Application',
          description: 'Apply negotiated corporate rates',
          type: 'custom',
          assignedToRole: 'manager',
          timeout: 30
        },
        {
          name: 'Finance Approval',
          description: 'Approve corporate billing arrangement',
          type: 'approval',
          assignedToRole: 'finance',
          timeout: 480
        },
        {
          name: 'Corporate Confirmation',
          description: 'Send corporate booking confirmation',
          type: 'notification',
          autoExecute: true,
          dependencies: ['finance-approval']
        }
      ],
      conditions: {
        guestType: ['corporate'],
        roomCount: { min: 5 }
      }
    };

    this.templates.set(standardTemplate.id, standardTemplate);
    this.templates.set(vipTemplate.id, vipTemplate);
    this.templates.set(corporateTemplate.id, corporateTemplate);
  }

  // Workflow Creation and Management
  async createWorkflow(reservationData: Record<string, unknown>): Promise<ReservationWorkflow> {
    const template = this.selectTemplate(reservationData);
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const workflow: ReservationWorkflow = {
      id: workflowId,
      reservationId: reservationData.id || reservationData._id,
      workflowType: template.workflowType,
      priority: this.calculatePriority(reservationData),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: this.getCurrentUserId(),
      steps: template.steps.map((stepTemplate, index) => ({
        id: `step-${index + 1}-${stepTemplate.name.toLowerCase().replace(/\s+/g, '-')}`,
        ...stepTemplate,
        status: index === 0 ? 'pending' : 'pending'
      })),
      reservationData,
      metadata: {
        guestType: this.determineGuestType(reservationData),
        totalAmount: reservationData.totalAmount || 0,
        roomCount: reservationData.rooms?.length || 1,
        specialRequirements: reservationData.specialRequests || [],
        approvalRequired: this.requiresApproval(reservationData),
        escalationLevel: 0
      },
      notifications: []
    };

    this.workflows.set(workflowId, workflow);

    // Start the workflow
    await this.processNextStep(workflowId);

    return workflow;
  }

  private selectTemplate(reservationData: Record<string, unknown>): WorkflowTemplate {
    const guestType = this.determineGuestType(reservationData);
    const totalAmount = reservationData.totalAmount || 0;
    const roomCount = reservationData.rooms?.length || 1;

    // Find matching template based on conditions
    for (const template of this.templates.values()) {
      if (!template.isActive) continue;

      const conditions = template.conditions;
      let matches = true;

      if (conditions.guestType && !conditions.guestType.includes(guestType)) {
        matches = false;
      }

      if (conditions.reservationValue) {
        if (conditions.reservationValue.min && totalAmount < conditions.reservationValue.min) matches = false;
        if (conditions.reservationValue.max && totalAmount > conditions.reservationValue.max) matches = false;
      }

      if (conditions.roomCount) {
        if (conditions.roomCount.min && roomCount < conditions.roomCount.min) matches = false;
        if (conditions.roomCount.max && roomCount > conditions.roomCount.max) matches = false;
      }

      if (matches) {
        return template;
      }
    }

    // Fallback to standard template
    return this.templates.get('standard-reservation')!;
  }

  private determineGuestType(reservationData: Record<string, unknown>): 'individual' | 'corporate' | 'group' | 'vip' {
    if (reservationData.vipStatus === 'vip' || reservationData.vipStatus === 'svip') {
      return 'vip';
    }
    if (reservationData.corporateBooking || reservationData.vipStatus === 'corporate') {
      return 'corporate';
    }
    if (reservationData.rooms?.length > 3 || reservationData.adults > 6) {
      return 'group';
    }
    return 'individual';
  }

  private calculatePriority(reservationData: Record<string, unknown>): 'low' | 'medium' | 'high' | 'urgent' {
    const totalAmount = reservationData.totalAmount || 0;
    const guestType = this.determineGuestType(reservationData);
    const checkInDate = new Date(reservationData.checkIn);
    const daysUntilArrival = Math.ceil((checkInDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (guestType === 'vip' || totalAmount > 100000) return 'urgent';
    if (daysUntilArrival <= 1 || totalAmount > 50000) return 'high';
    if (daysUntilArrival <= 7 || totalAmount > 20000) return 'medium';
    return 'low';
  }

  private requiresApproval(reservationData: Record<string, unknown>): boolean {
    const totalAmount = reservationData.totalAmount || 0;
    const roomCount = reservationData.rooms?.length || 1;
    const hasSpecialRequests = (reservationData.specialRequests?.length || 0) > 0;

    return totalAmount > 75000 || roomCount > 10 || hasSpecialRequests;
  }

  // Step Processing
  async processNextStep(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'active') return;

    const nextStep = this.getNextPendingStep(workflow);
    if (!nextStep) {
      await this.completeWorkflow(workflowId);
      return;
    }


    nextStep.status = 'in_progress';
    workflow.currentStep = nextStep.id;
    workflow.updatedAt = new Date();

    // Set timeout if specified
    if (nextStep.timeout) {
      const timerKey = `${workflowId}-${nextStep.id}`;
      const existingTimer = this.stepTimeoutTimers.get(timerKey);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        this.stepTimeoutTimers.delete(timerKey);
        if (nextStep.status === 'in_progress') {
          this.timeoutStep(workflowId, nextStep.id);
        }
      }, nextStep.timeout * 60 * 1000);
      this.stepTimeoutTimers.set(timerKey, timer);
    }

    // Auto-execute if applicable
    if (nextStep.autoExecute) {
      await this.executeStep(workflowId, nextStep.id, { automated: true });
    } else {
      // Assign to user/role
      await this.assignStepToUser(workflowId, nextStep.id);
    }

    this.notifySubscribers(workflow);
  }

  private getNextPendingStep(workflow: ReservationWorkflow): WorkflowStep | null {
    // Find the next step that is pending and has all dependencies completed
    for (const step of workflow.steps) {
      if (step.status !== 'pending') continue;

      // Check dependencies
      if (step.dependencies) {
        const dependenciesMet = step.dependencies.every(depId =>
          workflow.steps.some(s => s.id === depId && s.status === 'completed')
        );
        if (!dependenciesMet) continue;
      }

      return step;
    }

    return null;
  }

  async executeStep(workflowId: string, stepId: string, context: Record<string, unknown> = {}): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step || step.status !== 'in_progress') return false;

    try {
      let success = false;

      switch (step.type) {
        case 'validation':
          success = await this.executeValidationStep(step, workflow, context);
          break;
        case 'assignment':
          success = await this.executeAssignmentStep(step, workflow, context);
          break;
        case 'approval':
          success = await this.executeApprovalStep(step, workflow, context);
          break;
        case 'notification':
          success = await this.executeNotificationStep(step, workflow, context);
          break;
        case 'payment':
          success = await this.executePaymentStep(step, workflow, context);
          break;
        case 'custom':
          success = await this.executeCustomStep(step, workflow, context);
          break;
        default:
          success = true; // Unknown step type, mark as completed
      }

      if (success) {
        step.status = 'completed';
        step.completedAt = new Date();
        step.completedBy = context.userId || this.getCurrentUserId();
        step.notes = context.notes || '';


        // Process next step
        await this.processNextStep(workflowId);
        return true;
      } else {
        step.status = 'failed';
        step.notes = context.errorMessage || 'Step execution failed';
        await this.escalateWorkflow(workflowId, `Step failed: ${step.name}`);
        return false;
      }

    } catch (error: unknown) {
      const err = error as { message?: string };
      step.status = 'failed';
      step.notes = err.message || 'Unexpected error occurred';
      await this.escalateWorkflow(workflowId, `Step error: ${step.name} - ${err.message}`);
      return false;
    }
  }

  // Step Execution Methods
  private async executeValidationStep(step: WorkflowStep, workflow: ReservationWorkflow, context: Record<string, unknown>): Promise<boolean> {
    const reservation = workflow.reservationData;

    // Validate guest information
    if (!reservation.userId?.email || !reservation.userId?.name) {
      throw new Error('Guest information incomplete');
    }

    // Validate payment information if required
    if (reservation.totalAmount > 0 && !reservation.paymentStatus) {
      throw new Error('Payment information missing');
    }

    // VIP validation
    if (workflow.workflowType === 'vip') {
      // Additional VIP validation logic
    }

    return true;
  }

  private async executeAssignmentStep(step: WorkflowStep, workflow: ReservationWorkflow, context: Record<string, unknown>): Promise<boolean> {
    const reservation = workflow.reservationData;

    try {
      if (context.automated) {
        // Auto-assign using existing logic
        const result = await tapeChartService.autoAssignRooms(reservation.id);
        return true;
      } else {
        // Manual assignment required - step will wait for user action
        return context.manualAssignment === true;
      }
    } catch (error) {
      return false;
    }
  }

  private async executeApprovalStep(step: WorkflowStep, workflow: ReservationWorkflow, context: Record<string, unknown>): Promise<boolean> {
    // Approval steps are typically completed by user action
    return context.approved === true;
  }

  private async executeNotificationStep(step: WorkflowStep, workflow: ReservationWorkflow, context: Record<string, unknown>): Promise<boolean> {
    const reservation = workflow.reservationData;

    // Send confirmation email
    const notification = {
      type: 'email' as const,
      recipient: reservation.userId?.email || '',
      message: this.generateConfirmationMessage(reservation, workflow),
      sentAt: new Date(),
      status: 'sent' as const
    };

    workflow.notifications.push(notification);

    return true;
  }

  private async executePaymentStep(step: WorkflowStep, workflow: ReservationWorkflow, context: Record<string, unknown>): Promise<boolean> {
    // Payment processing logic
    return true;
  }

  private async executeCustomStep(step: WorkflowStep, workflow: ReservationWorkflow, context: Record<string, unknown>): Promise<boolean> {
    // Custom step logic based on step name or data
    return true;
  }

  // Workflow Management
  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';
    workflow.updatedAt = new Date();
    workflow.currentStep = undefined;


    toast.success(`Reservation workflow completed for ${workflow.reservationData.userId?.name}`);
    this.notifySubscribers(workflow);
  }

  private async escalateWorkflow(workflowId: string, reason: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.metadata.escalationLevel++;
    workflow.priority = workflow.priority === 'urgent' ? 'urgent' :
                       workflow.priority === 'high' ? 'urgent' :
                       workflow.priority === 'medium' ? 'high' : 'medium';


    toast.error(`Workflow escalated: ${reason}`);
    this.notifySubscribers(workflow);
  }

  private async timeoutStep(workflowId: string, stepId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step || step.status !== 'in_progress') return;

    step.status = 'failed';
    step.notes = `Step timed out after ${step.timeout} minutes`;

    await this.escalateWorkflow(workflowId, `Step timeout: ${step.name}`);
  }

  private async assignStepToUser(workflowId: string, stepId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) return;

    // Logic to assign step to specific user or role
  }

  // Utility Methods
  private generateConfirmationMessage(reservation: Record<string, unknown>, workflow: ReservationWorkflow): string {
    const guestName = reservation.userId?.name || 'Guest';
    const roomType = reservation.roomType || 'Room';
    const checkIn = new Date(reservation.checkIn).toLocaleDateString();
    const checkOut = new Date(reservation.checkOut).toLocaleDateString();

    return `Dear ${guestName},\n\nYour ${workflow.workflowType} reservation has been confirmed!\n\nDetails:\n- Room: ${roomType}\n- Check-in: ${checkIn}\n- Check-out: ${checkOut}\n- Confirmation: ${reservation.bookingNumber}\n\nThank you for choosing our hotel!`;
  }

  private getCurrentUserId(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.id || user._id || 'system';
  }

  // Public API Methods
  getWorkflow(workflowId: string): ReservationWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  getWorkflowsByReservation(reservationId: string): ReservationWorkflow[] {
    return Array.from(this.workflows.values()).filter(w => w.reservationId === reservationId);
  }

  getAllActiveWorkflows(): ReservationWorkflow[] {
    return Array.from(this.workflows.values()).filter(w => w.status === 'active');
  }

  getWorkflowsByStatus(status: ReservationWorkflow['status']): ReservationWorkflow[] {
    return Array.from(this.workflows.values()).filter(w => w.status === status);
  }

  getWorkflowsByPriority(priority: ReservationWorkflow['priority']): ReservationWorkflow[] {
    return Array.from(this.workflows.values()).filter(w => w.priority === priority);
  }

  // Subscription Management
  subscribe(workflowId: string, callback: (workflow: ReservationWorkflow) => void): void {
    this.activeSubscriptions.set(workflowId, callback);
  }

  unsubscribe(workflowId: string): void {
    this.activeSubscriptions.delete(workflowId);
  }

  private notifySubscribers(workflow: ReservationWorkflow): void {
    const callback = this.activeSubscriptions.get(workflow.id);
    if (callback) {
      callback(workflow);
    }
  }

  // Manual Actions
  async approveStep(workflowId: string, stepId: string, notes?: string): Promise<boolean> {
    return await this.executeStep(workflowId, stepId, {
      approved: true,
      notes,
      userId: this.getCurrentUserId()
    });
  }

  async rejectStep(workflowId: string, stepId: string, reason: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'failed';
    step.notes = `Rejected: ${reason}`;
    step.completedBy = this.getCurrentUserId();

    await this.escalateWorkflow(workflowId, `Step rejected: ${step.name} - ${reason}`);
  }

  async completeManualStep(workflowId: string, stepId: string, data: Record<string, unknown>): Promise<boolean> {
    return await this.executeStep(workflowId, stepId, {
      ...data,
      manualAssignment: true,
      userId: this.getCurrentUserId()
    });
  }

  // Analytics
  getWorkflowStats(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    avgCompletionTime: number;
  } {
    const workflows = Array.from(this.workflows.values());

    const stats = {
      total: workflows.length,
      active: workflows.filter(w => w.status === 'active').length,
      completed: workflows.filter(w => w.status === 'completed').length,
      failed: workflows.filter(w => w.status === 'failed').length,
      byPriority: {
        low: workflows.filter(w => w.priority === 'low').length,
        medium: workflows.filter(w => w.priority === 'medium').length,
        high: workflows.filter(w => w.priority === 'high').length,
        urgent: workflows.filter(w => w.priority === 'urgent').length
      },
      byType: {
        standard: workflows.filter(w => w.workflowType === 'standard').length,
        vip: workflows.filter(w => w.workflowType === 'vip').length,
        corporate: workflows.filter(w => w.workflowType === 'corporate').length,
        group: workflows.filter(w => w.workflowType === 'group').length
      },
      avgCompletionTime: this.calculateAverageCompletionTime(workflows)
    };

    return stats;
  }

  private calculateAverageCompletionTime(workflows: ReservationWorkflow[]): number {
    const completedWorkflows = workflows.filter(w => w.status === 'completed');
    if (completedWorkflows.length === 0) return 0;

    const totalTime = completedWorkflows.reduce((sum, workflow) => {
      return sum + (workflow.updatedAt.getTime() - workflow.createdAt.getTime());
    }, 0);

    return totalTime / completedWorkflows.length / (1000 * 60); // Return in minutes
  }

  cleanup(): void {
    this.stepTimeoutTimers.forEach(timer => clearTimeout(timer));
    this.stepTimeoutTimers.clear();
    this.activeSubscriptions.clear();
  }
}

export const workflowEngine = ReservationWorkflowEngine.getInstance();