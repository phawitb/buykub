import EditProductPage from "../../../[id]/edit/page";
import { WorkspaceDialog } from "@/features/products/components/WorkspaceDialog";

export default async function EditProductModal({ params }: { params: Promise<{ id: string }> }) {
  const editor = await EditProductPage({ params });
  return <WorkspaceDialog label="แก้ไขสินค้า">{editor}</WorkspaceDialog>;
}
