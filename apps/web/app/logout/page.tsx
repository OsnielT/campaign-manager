import { redirect } from "next/navigation";

// Legacy redirect — logout is now handled by Clerk's signOut() in the sidebar
export default function LogoutPage() {
  redirect("/login");
}
