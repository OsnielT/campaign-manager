// Full-screen builder — renders outside the AdminShell sidebar layout
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function ComposeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (!session.orgId) redirect("/onboarding");

  // Intentionally no AdminShell wrapper — builder is full-screen
  return <>{children}</>;
}
