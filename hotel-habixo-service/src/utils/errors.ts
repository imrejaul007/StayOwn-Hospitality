export class HabitError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'HABIT_ERROR'
  ) {
    super(message);
    this.name = 'HabitError';
  }
}

export class NotFoundError extends HabitError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      404,
      'NOT_FOUND'
    );
  }
}

export class ValidationError extends HabitError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends HabitError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends HabitError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends HabitError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}
