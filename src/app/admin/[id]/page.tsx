import { notFound, redirect } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { SetupRequired } from "@/components/editor/SetupRequired";
import { isAuthenticated } from "@/lib/auth";
import { getQuotationById } from "@/lib/db";
import { DATABASE_ENV_VARS, StorageNotConfiguredError } from "@/lib/store";
import { uploadBackend } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit quotation — Admin" };

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const { id } = await params;

  try {
    const quotation = await getQuotationById(id);
    if (!quotation) notFound();
    return <Editor initial={quotation} uploadsEnabled={uploadBackend() !== "unavailable"} />;
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return <SetupRequired detail={error.message} checked={DATABASE_ENV_VARS} />;
    }
    throw error;
  }
}
