import * as SecureStore from 'expo-secure-store';

const API_URL = 'http://localhost:3000/api'; // Update this for real device testing

export async function apiFetch<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    token?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const { method = 'GET', body, token, headers = {} } = options;

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    fetchHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: fetchHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.code || 'API Error');
  }

  return data as T;
}
