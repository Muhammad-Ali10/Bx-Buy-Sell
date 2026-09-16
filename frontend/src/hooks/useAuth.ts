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

    /**
     * Ask the server who this is, now and then.
     *
     * The five-second loop above only re-reads localStorage, so a tab left open
     * would never learn that its role had changed. A minute is slow enough to
     * cost nothing and quick enough that nobody keeps powers they no longer
     * have for long; a reload settles it immediately either way.
     */
    const roleWatch = setInterval(() => {
      try {
        const raw = localStorage.getItem('user_data');
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.id) void verifyStoredSession(parsed.id);
      } catch {
        // Unreadable storage is checkAuth's problem, not this one's.
      }
    }, 60000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:logout', handleLogout);
      clearInterval(interval);
      clearInterval(roleWatch);
    };
  }, []);

  /**
   * Confirm the stored token is still good.
   *
   * Reading localStorage only tells us a session *was* started, not that it is
   * still valid — a token that has expired or been revoked leaves the name sitting
   * in the header long after the account is effectively logged out. Asking the
   * server settles it. A 401 here also trips the api client's own `auth:logout`,
   * so the two paths agree.
   */
  const verifyStoredSession = async (userId: string) => {
    try {
      // A 401 or a blocked 403 is handled inside the api client, which clears
      // the token and fires `auth:logout` — the listener above then empties the
      // header. Deciding that here instead would risk logging someone out over
      // a 500 or a dropped connection.
      const response = await apiClient.getUserById(userId);
      if (!response.success || !response.data) return;

      const fresh: any = (response.data as any)?.data ?? response.data;
      if (!fresh?.id) return;

      /**
       * The role the server holds now, not the one the session was minted with.
       *
       * The result of this call used to be thrown away, so the browser kept
       * whatever role it was given at sign-in for as long as the session
       * lasted. The guards on the server always read the database and so were
       * right, but the screens read this — an administrator demoted an hour ago
       * still saw an administrator's menu, and only a fresh login corrected it.
       *
       * Any change ends the session. Applying the new role in place would be
       * kinder, but a page mid-render under one set of permissions is not a
       * page you want to hand a different set to; signing back in is one click
       * and leaves nothing half-applied.
       */
      const storedRaw = localStorage.getItem('user_data');
      const stored = storedRaw ? JSON.parse(storedRaw) : null;
      const before = String(stored?.role || '').toUpperCase();
      const after = String(fresh.role || '').toUpperCase();

      if (before && after && before !== after) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('bearer_token');
        apiClient.clearToken();
        window.dispatchEvent(
          new CustomEvent('auth:logout', { detail: { reason: 'role-changed' } }),
        );
        const target = window.location.pathname.startsWith('/admin')
          ? '/admin/login?role=1'
          : '/login?role=1';
        if (window.location.pathname !== target.split('?')[0]) {
          window.location.href = target;
        }
        return;
      }

      // No role change: keep the rest of the record fresh, so `blocked` and the
      // name in the header are the server's answer rather than sign-in's.
      if (stored) {
        const merged = { ...stored, ...fresh };
        if (JSON.stringify(merged) !== JSON.stringify(stored)) {
          localStorage.setItem('user_data', JSON.stringify(merged));
          setUser(merged);
        }
      }
    } catch {
      // A failed request is not proof the session is dead.
    }
  };

  const clearSession = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    setUser(null);
  };

  const checkAuth = async (isInitial: boolean = false) => {
    try {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');

      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          // Only swap the object when the stored data actually changed. This
          // runs every few seconds, and a fresh object each time would restart
          // every effect that depends on `user` across the whole app.
          setUser((current) =>
            JSON.stringify(current) === JSON.stringify(parsedUser) ? current : parsedUser,
          );
          // Ensure API client has the token
          apiClient.setToken(token);
          apiClient.setBearerToken(token);

          if (isInitial) {
            void verifyStoredSession(parsedUser.id);
          }
        } catch (parseError) {
          console.error('Error parsing user data:', parseError);
          // Clear invalid data
          clearSession();
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
    business_name?: string;
  }) => {
    // Nothing is registered yet: the account is made when the emailed code
    // comes back right (`confirmSignup`), so there is no user to set here.
    const response = await apiClient.signUp(userData);
    if (response.success) {
      const data = (response.data ?? {}) as { email?: string };
      return { success: true as const, email: data.email ?? userData.email };
    }
    return { success: false as const, error: response.error };
  };

  /** Enter the emailed code: the account is made and signed in. */
  const confirmSignup = async (email: string, code: string) => {
    const response = await apiClient.verifyOTP({ email, otp_code: code });
    const data = response.data as { user?: User } | undefined;
    if (response.success && data?.user) {
      setUser(data.user);
      return { success: true as const, user: data.user };
    }
    return { success: false as const, error: response.error };
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
    confirmSignup,
    logout,
    refreshUser,
    isAuthenticated: !!user,
  };
};

