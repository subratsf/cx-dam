import axios from 'axios';
import { ApiResponse } from '@cx-dam/shared';

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to handle API responses
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to home
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Helper to extract data from API response
export function extractData<T>(response: { data: ApiResponse<T> }): T {
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Unknown error');
  }
  return response.data.data;
}
