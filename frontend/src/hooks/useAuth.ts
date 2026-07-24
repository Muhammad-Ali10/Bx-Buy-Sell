import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { LISTING_PUBLISH_PENDING_SESSION_KEY } from "@/lib/listingGuestSession";

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  phone?: string;
  business_name?: string;
  profile_pic?: string;
  availability_status?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial auth check on mount
    checkAuth(true);
    
    // Listen for storage changes (when user logs in/out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' || e.key === 'user_data') {
        checkAuth(false);
      }
    };
    
    // Listen for logout events from API client
    const handleLogout = () => {
      setUser(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      // Don't set loading to false here - let checkAuth handle it
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth:logout', handleLogout);
    
    // Also check periodically (every 5 seconds) to catch local changes
    // Only update user state, don't reset loading after initial check
    const interval = setInterval(() => {
      checkAuth(false);
    }, 5000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:logout', handleLogout);
      clearInterval(interval);
    };
  }, []);

  const checkAuth = async (isInitial: boolean = false) => {
    try {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');
      
      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          // Ensure API client has the token
          apiClient.setToken(token);
          apiClient.setBearerToken(token);
        } catch (parseError) {
          console.error('Error parsing user data:', parseError);
          // Clear invalid data
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
          setUser(null);
        }
      } else {
        // No token or user data - ensure user is null
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
    } finally {
      // Only set loading to false on initial check
      // Subsequent checks (periodic, storage changes) should not reset loading
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  const login = async (email: string, password: string) => {
    const response = await apiClient.signIn({ email, password });
    const data = response.data as { user?: User } | undefined;
    
    if (response.success && data?.user) {
      setUser(data.user);
      return { success: true, user: data.user };
    }

    return { success: false, error: response.error };
  };

  const signup = async (userData: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => {
    const response = await apiClient.signUp(userData);
    const data = response.data as { user?: User } | undefined;
    
    if (response.success && data?.user) {
      setUser(data.user);
      if (
        typeof window !== "undefined" &&
        sessionStorage.getItem(LISTING_PUBLISH_PENDING_SESSION_KEY) === "1"
      ) {
        window.location.assign("/dashboard");
      }
      return { success: true, user: data.user };
    }

    return { success: false, error: response.error };
  };

  const logout = async () => {
    if (user?.id) {
      await apiClient.logout(user.id);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    setUser(null);
  };

  const refreshUser = async () => {
    if (user?.id) {
      const response = await apiClient.getUserById(user.id);
      if (response.success && response.data) {
        const nextUser = response.data as User;
        setUser(nextUser);
        localStorage.setItem('user_data', JSON.stringify(nextUser));
      }
    }
  };

  return {
    user,
    loading,
    login,
    signup,
    logout,
    refreshUser,
    isAuthenticated: !!user,
  };
};

