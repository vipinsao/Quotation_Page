import { redirect } from "next/navigation";
import { QuotationList } from "@/components/editor/QuotationList";
import { authDisabled, isAuthenticated } from "@/lib/auth";
import { listQuotations } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Quotations — Admin" };

export default async function AdminHome() {
  if (!(await isAuthenticated())) redirect("/admin/login");
  return <QuotationList initial={listQuotations()} unlocked={authDisabled()} />;
}
