const MAX_INPUT_LENGTH = 200;

export interface ValidationError {
  status: number;
  error: string;
}

export function validateStringField(value: unknown, name: string): ValidationError | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return { status: 400, error: `${name} is required` };
  }
  if (value.length > MAX_INPUT_LENGTH) {
    return { status: 422, error: `${name} must be ${MAX_INPUT_LENGTH} characters or fewer` };
  }
  return null;
}

export function validateOptionalStringField(value: unknown, name: string): ValidationError | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    return { status: 400, error: `${name} must be a string` };
  }
  if (value.length > MAX_INPUT_LENGTH) {
    return { status: 422, error: `${name} must be ${MAX_INPUT_LENGTH} characters or fewer` };
  }
  return null;
}
