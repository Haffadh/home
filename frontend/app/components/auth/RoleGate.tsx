"use client";

import { useAuth } from "../../context/AuthContext";

type RoleGateProps = {
  allowedRoles: string[];
  children: React.ReactNode;
};

export default function RoleGate({ allowedRoles, children }: RoleGateProps) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}
