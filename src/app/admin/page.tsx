import { redirect } from "next/navigation";
import { QuotationList } from "@/components/editor/QuotationList";
import { authDisabled, isAuthenticated } from "@/lib/auth";
import { listQuotations, storeKind } from "@/lib/db";
import { uploadBackend } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Quotations — Admin" };

export default async function AdminHome() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  return (
    <QuotationList
      initial={await listQuotations()}
      unlocked={authDisabled()}
      storage={{ database: storeKind(), uploads: uploadBackend() }}
    />
  );
}
