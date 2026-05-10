'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, AuthState } from '../types/auth';
import { apiFetch } from '../lib/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoading: true,
  });
  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      if (state.refreshToken && state.accessToken) {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: state.refreshToken }),
          token: state.accessToken,
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setState({ user: null, accessToken: null, refreshToken: null, isLoading: false });
      router.push('/login');
    }
  }, [state.accessToken, state.refreshToken, router]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    setState({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      isLoading: false,
    });

    if (data.user.role === 'admin') {
      router.push('/admin/workshops');
    } else {
      router.push('/workshops');
    }
  };

  const refreshAccessToken = useCallback(async (token: string) => {
    try {
      const data = await apiFetch<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: token }),
      });
      return data.accessToken;
    } catch (error) {
      console.error('Refresh token error:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedRefreshToken = localStorage.getItem('refreshToken');
      const storedUser = localStorage.getItem('user');

      if (storedRefreshToken && storedUser) {
        const newAccessToken = await refreshAccessToken(storedRefreshToken);
        if (newAccessToken) {
          setState({
            user: JSON.parse(storedUser),
            accessToken: newAccessToken,
            refreshToken: storedRefreshToken,
            isLoading: false,
          });
        } else {
          logout();
        }
      } else {
        setState(s => ({ ...s, isLoading: false }));
      }
    };

    initAuth();
  }, [refreshAccessToken, logout]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
