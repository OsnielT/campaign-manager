import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ProductsClient } from "./ProductsClient";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const session = await getSession();
  if (!session.userId || !session.orgId) redirect("/login");

  return <ProductsClient orgId={session.orgId} />;
}
