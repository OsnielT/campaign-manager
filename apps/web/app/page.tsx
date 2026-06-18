import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function RootPage() {
  const session = await getSession();
  if (session.userId) {
    redirect(session.orgId ? "/dashboard" : "/onboarding");
  }
  redirect("/login");
}
