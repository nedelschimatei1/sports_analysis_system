"use client"

import { useState, useEffect } from "react"
import type { User } from "../types/auth"

interface LoginResponse {
  user: User;
  message?: string;
  token?: string;
}

interface SignupResponse {
  user: User;
  message?: string;
}

interface MeResponse {
  user: User;
  authenticated: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true;

    const checkAuthStatus = async () => {
      try {
        console.log('🔍 Checking authentication status with Spring backend...');

        const token = localStorage.getItem('authToken');

        if (!token) {
          console.log('❌ No token found in localStorage');
          if (isMounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/validate`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const savedUser = localStorage.getItem('currentUser');
          if (savedUser && isMounted) {
            const user = JSON.parse(savedUser);
            console.log('✅ User authenticated:', user.email);
            setUser(user);
          } else {
            console.log('❌ Token valid but no user data found');
            if (isMounted) setUser(null);
          }
        } else {
          console.log('❌ Token validation failed');
          localStorage.removeItem('authToken');
          localStorage.removeItem('currentUser');
          if (isMounted) setUser(null);
        }
      } catch (error) {
        console.log('❌ Authentication check failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkAuthStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('🔐 Attempting login for:', email);

      const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        console.log('❌ Login failed with status:', response.status);
        return false;
      }

      const data = await response.json();

      if (data.token) {
        console.log('✅ Login successful, received token');
        localStorage.setItem('authToken', data.token);

        let user: User;
        if (data.user && data.user.id) {
          user = {
            id: data.user.id,
            email: data.user.email || email,
            name: data.user.name || email.split('@')[0],
            createdAt: data.user.createdAt || new Date().toISOString()
          };
        } else {
          user = {
            id: Date.now().toString(),
            email: email,
            name: email.split('@')[0],
            createdAt: new Date().toISOString()
          };
        }

        localStorage.setItem('currentUser', JSON.stringify(user));
        setUser(user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Login failed:', error);
      return false;
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      console.log('📝 Attempting signup for:', email);

      const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      if (!response.ok) {
        console.log('❌ Signup failed with status:', response.status);
        return false;
      }

      const data = await response.json();

      if (data.token) {
        console.log('✅ Signup successful, received token');
        localStorage.setItem('authToken', data.token);

        let user: User;
        if (data.user && data.user.id) {
          user = {
            id: data.user.id,
            email: data.user.email || email,
            name: data.user.name || name,
            createdAt: data.user.createdAt || new Date().toISOString()
          };
        } else {
          user = {
            id: Date.now().toString(),
            email: email,
            name: name,
            createdAt: new Date().toISOString()
          };
        }

        localStorage.setItem('currentUser', JSON.stringify(user));
        setUser(user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Signup failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      console.log('🔓 Logging out user...');
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      setUser(null);
    } catch (error) {
      console.error('❌ Logout failed:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      setUser(null);
    }
  };

  const updateUser = async (updatedUser: Partial<User>): Promise<boolean> => {
    try {
      console.log('📝 Updating user profile...');
      if (user) {
        const newUser = { ...user, ...updatedUser };
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        setUser(newUser);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Profile update failed:', error);
      return false;
    }
  };

  return { user, isLoading, login, signup, logout, updateUser };
}