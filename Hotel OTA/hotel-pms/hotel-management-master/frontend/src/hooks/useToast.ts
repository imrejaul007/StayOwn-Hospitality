import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface ToastOptions {
  duration?: number;
  position?: 'top-center' | 'top-left' | 'top-right' | 'bottom-center' | 'bottom-left' | 'bottom-right';
}

export const useToast = () => {
  const [isLoading, setIsLoading] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'loading' = 'success', options?: ToastOptions) => {
    const toastOptions = {
      duration: options?.duration || (type === 'error' ? 6000 : 4000),
      position: options?.position || 'top-right' as const,
      style: {
        background: type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6',
        color: '#FFFFFF',
        fontWeight: '500',
      }
    };

    switch (type) {
      case 'success':
        return toast.success(message, toastOptions);
      case 'error':
        return toast.error(message, toastOptions);
      case 'loading':
        setIsLoading(true);
        return toast.loading(message, toastOptions);
      default:
        return toast(message, toastOptions);
    }
  }, []);

  const showSuccess = useCallback((message: string, options?: ToastOptions) => {
    setIsLoading(false);
    return showToast(message, 'success', options);
  }, [showToast]);

  const showError = useCallback((message: string, options?: ToastOptions) => {
    setIsLoading(false);
    return showToast(message, 'error', options);
  }, [showToast]);

  const showLoading = useCallback((message: string, options?: ToastOptions) => {
    return showToast(message, 'loading', options);
  }, [showToast]);

  const dismiss = useCallback((toastId?: string) => {
    setIsLoading(false);
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  }, []);

  const promise = useCallback(async <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    },
    options?: ToastOptions
  ): Promise<T> => {
    setIsLoading(true);

    try {
      const result = await toast.promise(promise, messages, {
        style: {
          minWidth: '250px',
        },
        success: {
          duration: options?.duration || 4000,
          style: {
            background: '#10B981',
            color: '#FFFFFF',
          },
        },
        error: {
          duration: options?.duration || 6000,
          style: {
            background: '#EF4444',
            color: '#FFFFFF',
          },
        },
        loading: {
          style: {
            background: '#3B82F6',
            color: '#FFFFFF',
          },
        },
      });

      setIsLoading(false);
      return result;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }, []);

  return {
    showToast,
    showSuccess,
    showError,
    showLoading,
    dismiss,
    promise,
    isLoading
  };
};