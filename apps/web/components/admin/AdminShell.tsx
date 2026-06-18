import { AdminShellClient } from "./AdminShellClient";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <AdminShellClient>{children}</AdminShellClient>;
}
