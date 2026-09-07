import { redirect } from "next/navigation";
import { QuotationList } from "@/components/editor/QuotationList";
import { SetupRequired } from "@/components/editor/SetupRequired";
import { authDisabled, isAuthenticated } from "@/lib/auth";
import { listQuotations } from "@/lib/db";
import { DATABASE_ENV_VARS, StorageNotConfiguredError, storeKind } from "@/lib/store";
import { uploadBackend } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Quotations — Admin" };

export default async function AdminHome() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  try {
    const quotations = await listQuotations();
    return (
      <QuotationList
        initial={quotations}
        unlocked={authDisabled()}
        storage={{ database: storeKind(), uploads: uploadBackend() }}
      />
    );
  } catch (error) {
    // A misconfigured deployment should explain itself, not show a blank 500.
    if (error instanceof StorageNotConfiguredError) {
      return <SetupRequired detail={error.message} checked={DATABASE_ENV_VARS} />;
    }
    return (
      <SetupRequired
        detail={
          error instanceof Error
            ? `Could not reach the database: ${error.message}`
            : "Could not reach the database."
        }
        checked={DATABASE_ENV_VARS}
      />
    );
  }
}
