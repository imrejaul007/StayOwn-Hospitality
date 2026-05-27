import axios, { AxiosRequestConfig } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

const externalLogger = logger.child({ service: 'ExternalServices' });

interface HttpResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export async function httpRequest<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    timeout?: number;
    serviceName?: string;
  } = {}
): Promise<HttpResponse<T>> {
  const { method = 'GET', body, headers = {}, timeout = 10000, serviceName } = options;

  try {
    const response = await axios({
      url,
      method,
      data: body,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': config.internalToken,
        ...headers,
      },
      timeout,
    });

    return {
      success: true,
      data: response.data,
      statusCode: response.status,
    };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status: number; data: unknown }; message?: string };

    externalLogger.warn({
      url,
      method,
      serviceName,
      error: axiosError.message || 'Unknown error',
      statusCode: axiosError.response?.status,
    }, 'External service request failed');

    return {
      success: false,
      error: axiosError.message || 'Request failed',
      statusCode: axiosError.response?.status,
    };
  }
}

// Service URL helpers
export function getServiceUrl(service: keyof typeof config.services): string {
  return config.services[service];
}
