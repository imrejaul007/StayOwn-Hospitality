import { useState, useCallback } from 'react';
import { ZodSchema, ZodError } from 'zod';

interface ValidationState<T> {
  errors: Partial<Record<keyof T, string>>;
  isValid: boolean;
  touched: Partial<Record<keyof T, boolean>>;
}

interface UseFormValidationReturn<T> {
  errors: Partial<Record<keyof T, string>>;
  isValid: boolean;
  touched: Partial<Record<keyof T, boolean>>;
  validate: (data: T) => boolean;
  validateField: (field: keyof T, value: unknown) => boolean;
  clearErrors: () => void;
  clearFieldError: (field: keyof T) => void;
  setTouched: (field: keyof T, isTouched?: boolean) => void;
  getFieldError: (field: keyof T) => string | undefined;
  hasFieldError: (field: keyof T) => boolean;
}

export const useFormValidation = <T extends Record<string, unknown>>(
  schema: ZodSchema<T>
): UseFormValidationReturn<T> => {
  const [validationState, setValidationState] = useState<ValidationState<T>>({
    errors: {},
    isValid: true,
    touched: {}
  });

  const validate = useCallback((data: T): boolean => {
    try {
      schema.parse(data);
      setValidationState({
        errors: {},
        isValid: true,
        touched: validationState.touched
      });
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Partial<Record<keyof T, string>> = {};

        error.issues.forEach((issue) => {
          const path = issue.path.join('.') as keyof T;
          if (!errors[path]) {
            errors[path] = issue.message;
          }
        });

        setValidationState(prev => ({
          errors,
          isValid: false,
          touched: prev.touched
        }));
      }
      return false;
    }
  }, [schema, validationState.touched]);

  const validateField = useCallback((field: keyof T, value: unknown): boolean => {
    try {
      // Create a partial schema for the specific field
      const fieldSchema = schema.pick({ [field]: true } as unknown);
      fieldSchema.parse({ [field]: value });

      setValidationState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [field]: undefined
        },
        isValid: Object.keys(prev.errors).filter(key => key !== field).length === 0
      }));
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldError = error.issues[0]?.message;

        setValidationState(prev => ({
          ...prev,
          errors: {
            ...prev.errors,
            [field]: fieldError
          },
          isValid: false
        }));
      }
      return false;
    }
  }, [schema]);

  const clearErrors = useCallback(() => {
    setValidationState(prev => ({
      ...prev,
      errors: {},
      isValid: true
    }));
  }, []);

  const clearFieldError = useCallback((field: keyof T) => {
    setValidationState(prev => {
      const newErrors = { ...prev.errors };
      delete newErrors[field];

      return {
        ...prev,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0
      };
    });
  }, []);

  const setTouched = useCallback((field: keyof T, isTouched: boolean = true) => {
    setValidationState(prev => ({
      ...prev,
      touched: {
        ...prev.touched,
        [field]: isTouched
      }
    }));
  }, []);

  const getFieldError = useCallback((field: keyof T): string | undefined => {
    return validationState.errors[field];
  }, [validationState.errors]);

  const hasFieldError = useCallback((field: keyof T): boolean => {
    return Boolean(validationState.errors[field]);
  }, [validationState.errors]);

  return {
    errors: validationState.errors,
    isValid: validationState.isValid,
    touched: validationState.touched,
    validate,
    validateField,
    clearErrors,
    clearFieldError,
    setTouched,
    getFieldError,
    hasFieldError
  };
};