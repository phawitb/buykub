import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BookingTabs } from "./BookingTabs";
import { ServiceRow } from "./ServiceRow";

const FREE_PLAN_LIMIT = 5;

export default async function BookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user!.id)
    .maybeSingle();

  if (!shop) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-bold text-ink">บริการจอง</h1>
        <p className="mt-3 text-sm text-ink-soft">
          ตั้งชื่อร้านก่อนเปิดบริการจอง —{" "}
          <Link href="/dashboard/settings" className="font-semibold text-ink underline">
            ไปตั้งค่าร้าน
          </Link>
        </p>
      </div>
    );
  }

  const [{ data: services }, { data: bookings }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, price_cents, duration_minutes, published")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id, scheduled_at, price_cents, services(name)")
      .eq("shop_id", shop.id)
      .order("scheduled_at", { ascending: true })
      .limit(5),
  ]);

  const count = services?.length ?? 0;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">บริการจอง</h1>
          <p className="mt-1 text-sm text-muted">
            จัดการบริการจองและดูการจองที่เข้ามา ({count}/{FREE_PLAN_LIMIT} บริการ)
          </p>
        </div>
        <Link
          href="/dashboard/bookings/new"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper hover:bg-accent-hover"
        >
          สร้างบริการจอง
        </Link>
      </div>

      <BookingTabs
        services={
          <div className="space-y-3">
            {(services ?? []).map((service) => (
              <ServiceRow key={service.id} service={service} />
            ))}

            {count === 0 && (
              <div className="rounded-2xl border border-dashed border-line p-10 text-center">
                <h3 className="text-sm font-semibold text-ink">
                  ยังไม่มีบริการจอง
                </h3>
                <p className="mt-1 text-xs text-muted">
                  สร้างบริการจองเพื่อรับนัดหมายจากลูกค้า
                </p>
                <Link
                  href="/dashboard/bookings/new"
                  className="primary-button mt-4 inline-block"
                >
                  สร้างบริการจองแรก
                </Link>
              </div>
            )}
          </div>
        }
        incoming={
          <div className="space-y-2">
            {(bookings ?? []).map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between rounded-xl border border-line bg-paper p-4 text-sm"
              >
                <div>
                  <p className="font-medium text-ink">
                    {(
                      booking.services as unknown as { name: string } | null
                    )?.name ?? "บริการ"}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(booking.scheduled_at).toLocaleString("th-TH")}
                  </p>
                </div>
                <span className="font-semibold text-ink">
                  ฿{(booking.price_cents / 100).toLocaleString("th-TH")}
                </span>
              </div>
            ))}
            {(!bookings || bookings.length === 0) && (
              <div className="rounded-2xl border border-dashed border-line p-10 text-center">
                <p className="text-sm font-semibold text-ink">
                  ยังไม่มีการจองเข้ามา
                </p>
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
