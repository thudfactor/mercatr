import type { Response } from 'express';

const MAX_INPUT_LENGTH = 200;

export function validateStringField(value: unknown, name: string, res: Response): value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    res.status(400).json({ error: `${name} is required` });
    return false;
  }
  if (value.length > MAX_INPUT_LENGTH) {
    res.status(422).json({ error: `${name} must be ${MAX_INPUT_LENGTH} characters or fewer` });
    return false;
  }
  return true;
}

export function validateOptionalStringField(value: unknown, name: string, res: Response): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') {
    res.status(400).json({ error: `${name} must be a string` });
    return false;
  }
  if (value.length > MAX_INPUT_LENGTH) {
    res.status(422).json({ error: `${name} must be ${MAX_INPUT_LENGTH} characters or fewer` });
    return false;
  }
  return true;
}
