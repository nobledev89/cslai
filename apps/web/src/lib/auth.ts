import Cookies from 'js-cookie';
import { api } from './api';

export interface AuthUser {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
}

export async function login(email: string, password: string): Promise<string> {
  const { data } = await api.post<{ accessToken: string; expiresIn: number }>(
    '/auth/login',
    { email, password },
  );
  Cookies.set('access_token', data.accessToken, { expires: 1 / 96 }); // 15m
  return data.accessToken;
}

export async function register(
  email: string,
  password: string,
  companyName: string,
  name?: string,
): Promise<string> {
  const { data } = await api.post<{ accessToken: string; expiresIn: number }>(
    '/auth/register',
    { email, password, companyName, name },
  );
  Cookies.set('access_token', data.accessToken, { expires: 1 / 96 });
  return data.accessToken;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    Cookies.remove('access_token');
  }
}

export function getTokenPayload(): AuthUser | null {
  const token = Cookies.get('access_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!Cookies.get('access_token');
}
