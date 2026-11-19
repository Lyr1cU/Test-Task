import { registerDecorator, ValidationOptions } from 'class-validator';
import { parseDateOnly } from './dates';

export function IsDateOnly(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isDateOnly',
      target: object.constructor,
      propertyName,
      options: {
        message: 'Date must be a real calendar day in YYYY-MM-DD',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }
          try {
            parseDateOnly(value);
            return true;
          } catch {
            return false;
          }
        },
      },
    });
  };
}
