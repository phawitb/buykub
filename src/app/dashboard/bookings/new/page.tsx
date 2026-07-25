import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ServiceNewForm } from "./ServiceNewForm";

export default async function NewServicePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user!.id)
    .maybeSingle();

  if (!shop) redirect("/dashboard/settings");

  return (
    <div className="mx-auto max-w-2xl pt-3">
      <p className="text-xs text-muted">
        <Link href="/dashboard/bookings" className="hover:text-ink">
          จองบริการ
        </Link>{" "}
        / สร้างบริการใหม่
      </p>
      <h1 className="mt-7 text-2xl font-bold text-ink">สร้างบริการจอง</h1>

      <div className="mt-6">
        <ServiceNewForm shopId={shop.id} userId={user!.id} />
      </div>
    </div>
  );
}
