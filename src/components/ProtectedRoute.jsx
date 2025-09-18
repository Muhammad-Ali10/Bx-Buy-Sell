"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push("/signin");
    else if (role && user.role !== role) router.push("/unauthorized");
  }, [user]);

  if (!user) return <div>Loading...</div>;
  if (role && user.role !== role) return null;
  return <>{children}</>;
}
