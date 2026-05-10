import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../services/api';
import { registerForPushNotificationsAsync } from '../services/notifications';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'student' | 'admin' | 'staff';
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStorage = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('accessToken');
        const storedUser = await SecureStore.getItemAsync('user');
        
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setAccessToken(storedToken);
          setUser(parsedUser);
          // Refresh push token on every app load if logged in
          registerPushToken(storedToken);
        }
      } catch (e) {
        console.error('Failed to load auth state', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStorage();
  }, []);

  const registerPushToken = async (token: string) => {
    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        await apiFetch('/auth/profile', {
          method: 'PUT',
          token,
          body: { fcmToken: pushToken },
        });
      }
    } catch (e) {
      console.warn('Failed to register push token on server', e);
    }
  };

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(data.user));

    setAccessToken(data.accessToken);
    setUser(data.user);

    // Register push token after successful login
    registerPushToken(data.accessToken);
  };

  const logout = async () => {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        token: accessToken || undefined,
        body: { refreshToken },
      });
    } catch (e) {
      console.warn('Logout failed on server', e);
    }

    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');

    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
