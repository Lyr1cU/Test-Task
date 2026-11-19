import { BadRequestException } from '@nestjs/common';
import { toCents } from './money';

export function readAmount(amount: number): number {
  try {
    return toCents(amount);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid amount';
    throw new BadRequestException(message);
  }
}
