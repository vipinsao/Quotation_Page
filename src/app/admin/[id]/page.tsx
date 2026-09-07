import { notFound, redirect } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { isAuthenticated } from "@/lib/auth";
import { getQuotationById } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit quotation — Admin" };

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const { id } = await params;
  const quotation = getQuotationById(id);
  if (!quotation) notFound();

  return <Editor initial={quotation} />;
}
