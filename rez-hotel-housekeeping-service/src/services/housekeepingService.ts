/**
 * Housekeeping Service
 */

import { v4 as uuidv4 } from 'uuid';
import { RoomTask, IRoomTask } from '../models/roomTask';
import { HousekeepingStaff, IHousekeepingStaff } from '../models/housekeepingStaff';
import { RoomStatus, IRoomStatus } from '../models/roomStatus';

export interface CreateTaskParams {
  hotelId: string;
  roomId: string;
  roomNumber: string;
  taskType: IRoomTask['taskType'];
  priority?: IRoomTask['priority'];
  dueBy?: Date;
  guestId?: string;
  bookingId?: string;
  notes?: string;
}

export interface AssignTaskParams {
  taskId: string;
  staffId: string;
  staffName: string;
}

// Default checklists by task type
const DEFAULT_CHECKLISTS: Record<string, { item: string; completed: boolean }[]> = {
  cleaning: [
    { item: 'Remove trash', completed: false },
    { item: 'Change bed linens', completed: false },
    { item: 'Clean bathroom', completed: false },
    { item: 'Vacuum floors', completed: false },
    { item: 'Dust surfaces', completed: false },
    { item: 'Restock amenities', completed: false },
    { item: 'Final inspection', completed: false },
  ],
  deep_clean: [
    { item: 'All cleaning tasks', completed: false },
    { item: 'Clean under furniture', completed: false },
    { item: 'Clean air vents', completed: false },
    { item: 'Wash curtains', completed: false },
    { item: 'Clean mattress', completed: false },
    { item: 'Deep stain removal', completed: false },
  ],
  turndown: [
    { item: 'Turn down bed', completed: false },
    { item: 'Refresh bathroom', completed: false },
    { item: 'Set out bedtime amenities', completed: false },
    { item: 'Draw curtains', completed: false },
    { item: 'Remove visible clutter', completed: false },
  ],
  inspection: [
    { item: 'Check bed linens', completed: false },
    { item: 'Check bathroom cleanliness', completed: false },
    { item: 'Check amenities stocked', completed: false },
    { item: 'Check for damage', completed: false },
    { item: 'Check lighting', completed: false },
    { item: 'Overall impression', completed: false },
  ],
};

export async function createTask(params: CreateTaskParams): Promise<IRoomTask> {
  const checklist = DEFAULT_CHECKLISTS[params.taskType] || DEFAULT_CHECKLISTS.cleaning;

  const task = new RoomTask({
    ...params,
    checklist,
    status: 'pending',
  });

  await task.save();

  // Update room status to cleaning if vacant
  await RoomStatus.findOneAndUpdate(
    { roomId: params.roomId },
    { status: 'cleaning', cleaningStarted: new Date() }
  );

  return task;
}

export async function getTasks(hotelId: string, filters?: {
  status?: IRoomTask['status'];
  assignedTo?: string;
  priority?: IRoomTask['priority'];
  taskType?: IRoomTask['taskType'];
}): Promise<IRoomTask[]> {
  const query: Record<string, unknown> = { hotelId };

  if (filters?.status) query.status = filters.status;
  if (filters?.assignedTo) query.assignedTo = filters.assignedTo;
  if (filters?.priority) query.priority = filters.priority;
  if (filters?.taskType) query.taskType = filters.taskType;

  return RoomTask.find(query).sort({ priority: -1, dueBy: 1, createdAt: -1 });
}

export async function getTask(taskId: string): Promise<IRoomTask | null> {
  return RoomTask.findById(taskId);
}

export async function assignTask(params: AssignTaskParams): Promise<IRoomTask | null> {
  const task = await RoomTask.findByIdAndUpdate(
    params.taskId,
    {
      assignedTo: params.staffId,
      assignedToName: params.staffName,
      status: 'assigned',
    },
    { new: true }
  );

  if (task) {
    // Update staff active tasks
    await HousekeepingStaff.findOneAndUpdate(
      { staffId: params.staffId },
      { $inc: { activeTasks: 1 }, status: 'busy' }
    );
  }

  return task;
}

export async function startTask(taskId: string): Promise<IRoomTask | null> {
  return RoomTask.findByIdAndUpdate(
    taskId,
    { status: 'in_progress', startedAt: new Date() },
    { new: true }
  );
}

export async function completeTask(
  taskId: string,
  checklist: { item: string; completed: boolean }[]
): Promise<IRoomTask | null> {
  const task = await RoomTask.findByIdAndUpdate(
    taskId,
    {
      status: 'completed',
      completedAt: new Date(),
      checklist,
    },
    { new: true }
  );

  if (task) {
    // Update room status
    await RoomStatus.findOneAndUpdate(
      { roomId: task.roomId },
      { status: 'vacant_clean', lastCleaned: new Date(), lastCleanedBy: task.assignedTo }
    );

    // Update staff stats
    if (task.assignedTo) {
      await HousekeepingStaff.findOneAndUpdate(
        { staffId: task.assignedTo },
        {
          $inc: { activeTasks: -1, completedToday: 1 },
          $set: { status: 'available' },
        }
      );
    }
  }

  return task;
}

export async function verifyTask(taskId: string, supervisorId: string): Promise<IRoomTask | null> {
  return RoomTask.findByIdAndUpdate(
    taskId,
    {
      status: 'verified',
      verifiedAt: new Date(),
      verifiedBy: supervisorId,
    },
    { new: true }
  );
}

export async function getRoomStatuses(hotelId: string): Promise<IRoomStatus[]> {
  return RoomStatus.find({ hotelId }).sort({ roomNumber: 1 });
}

export async function updateRoomStatus(
  roomId: string,
  status: IRoomStatus['status'],
  notes?: string
): Promise<IRoomStatus | null> {
  return RoomStatus.findOneAndUpdate(
    { roomId },
    { status, notes },
    { new: true }
  );
}

export async function getStaff(hotelId: string): Promise<IHousekeepingStaff[]> {
  return HousekeepingStaff.find({ hotelId }).sort({ name: 1 });
}

export async function createStaff(params: {
  hotelId: string;
  name: string;
  phone: string;
  role: IHousekeepingStaff['role'];
  zones?: string[];
}): Promise<IHousekeepingStaff> {
  const staffId = `HK-${Date.now().toString(36).toUpperCase()}`;

  const staff = new HousekeepingStaff({
    ...params,
    staffId,
  });

  await staff.save();
  return staff;
}

export async function getDashboardStats(hotelId: string): Promise<{
  pendingTasks: number;
  inProgressTasks: number;
  completedToday: number;
  roomStatuses: Record<string, number>;
  staffStatus: Record<string, number>;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [pendingTasks, inProgressTasks, completedToday, rooms, staff] = await Promise.all([
    RoomTask.countDocuments({ hotelId, status: 'pending' }),
    RoomTask.countDocuments({ hotelId, status: { $in: ['assigned', 'in_progress'] } }),
    RoomTask.countDocuments({ hotelId, completedAt: { $gte: today } }),
    RoomStatus.find({ hotelId }),
    HousekeepingStaff.find({ hotelId }),
  ]);

  const roomStatuses: Record<string, number> = {};
  rooms.forEach((room) => {
    roomStatuses[room.status] = (roomStatuses[room.status] || 0) + 1;
  });

  const staffStatus: Record<string, number> = {};
  staff.forEach((s) => {
    staffStatus[s.status] = (staffStatus[s.status] || 0) + 1;
  });

  return { pendingTasks, inProgressTasks, completedToday, roomStatuses, staffStatus };
}
