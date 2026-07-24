import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

export const useAdminRole = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Check if user role is ADMIN or MONITER (admin roles)
      setIsAdmin(user.role === 'ADMIN' || user.role === 'MONITER');
      setLoading(false);
    } else {
      setIsAdmin(false);
      setLoading(false);
    }
  }, [user]);

  return { isAdmin, loading, refetch: () => {} };
};
