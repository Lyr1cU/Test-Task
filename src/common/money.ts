export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAmountError';
  }
}

/** Prisma maps SQLite integers to a signed 32-bit value. */
export const MAX_SALARY_CENTS = 2_147_483_647;
export const MAX_SALARY = MAX_SALARY_CENTS / 100;

export function toCents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new InvalidAmountError('Amount must be a non-negative number');
  }
  if (decimalPlaces(amount) > 2) {
    throw new InvalidAmountError('Amount must have at most 2 decimal places');
  }

  const cents = Math.round(amount * 100);
  if (cents > MAX_SALARY_CENTS) {
    throw new InvalidAmountError(`Amount must not exceed ${MAX_SALARY}`);
  }
  return cents;
}

export function fromCents(cents: number): number {
  return cents / 100;
}

function decimalPlaces(amount: number): number {
  const text = amount.toString().toLowerCase();
  if (text.includes('e')) {
    const [coefficient, exponentText] = text.split('e');
    const exponent = Number(exponentText);
    const fraction = coefficient.split('.')[1]?.length ?? 0;
    return Math.max(0, fraction - exponent);
  }
  return text.split('.')[1]?.length ?? 0;
}
