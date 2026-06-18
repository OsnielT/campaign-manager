import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { MediaBrowser } from "./MediaBrowser";

export const metadata = { title: "Media" };

export default async function MediaPage() {
  const session = await getSession();
  if (!session.userId || !session.orgId) redirect("/login");

  return <MediaBrowser />;
}
