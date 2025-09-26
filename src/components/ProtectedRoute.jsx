"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ProtectedRoute = ({ children, roles }) => {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/signin");
    else if (roles && !roles.includes(user.role)) router.replace("/unauthorized");
  }, [user, router, roles]);

  if (!user) return null;
  return children;
};

export default ProtectedRoute;
