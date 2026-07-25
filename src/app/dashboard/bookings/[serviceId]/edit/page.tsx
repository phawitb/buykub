import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ServiceNewForm, type ServiceFormValues } from "../../new/ServiceNewForm";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!shop) redirect("/dashboard/settings");

  const { data: service } = await supabase
    .from("services")
    .select("name, price_cents, duration_minutes, description, image_url, image_path, meet_link, availability")
    .eq("id", serviceId)
    .eq("shop_id", shop.id)
    .maybeSingle();
  if (!service) notFound();

  return (
    <div className="max-w-2xl">
      <p className="text-xs text-muted">
        <Link href="/dashboard/bookings" className="hover:text-ink">จองบริการ</Link>
        {" / แก้ไขบริการ"}
      </p>
      <h1 className="mt-1 text-xl font-bold text-ink">แก้ไขบริการจอง</h1>
      <div className="mt-8">
        <ServiceNewForm
          shopId={shop.id}
          userId={user.id}
          serviceId={serviceId}
          initialValues={service as ServiceFormValues}
        />
      </div>
    </div>
  );
}
