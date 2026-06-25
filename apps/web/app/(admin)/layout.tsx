import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session.userId) {
    redirect("/login");
  }

  if (!session.orgId) {
    redirect("/onboarding");
  }

  return (
    <AdminShell>
      {children}
    </AdminShell>
  );
}
