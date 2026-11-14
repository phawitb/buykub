import NewProductPage from "../../new/page";
import { WorkspaceDialog } from "@/features/products/components/WorkspaceDialog";

export default async function NewProductModal() {
  // Reuse the authenticated server page; no owner data is fetched by the shell.
  const editor = await NewProductPage();
  return <WorkspaceDialog label="สร้างสินค้าใหม่">{editor}</WorkspaceDialog>;
}
