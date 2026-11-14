import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BookingTabs } from "./BookingTabs";
import { BookingRow } from "./BookingRow";
import { ServiceRow } from "./ServiceRow";
import { PlusIcon } from "@/components/icons";

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
      .select("id, name, description, price_cents, duration_minutes, published, image_path")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id, buyer_name, buyer_email, scheduled_at, price_cents, status, services(name)")
      .eq("shop_id", shop.id)
      .order("scheduled_at", { ascending: true })
      .limit(5),
  ]);

  const count = services?.length ?? 0;

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">บริการจอง</h1>
          <p className="mt-1 text-sm text-muted">
            จัดการบริการจองและดูการจองที่เข้ามา ({count}/{FREE_PLAN_LIMIT} บริการ)
          </p>
        </div>
        <Link
          href="/dashboard/bookings/new"
          className="shrink-0 whitespace-nowrap rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-paper hover:bg-accent-hover sm:rounded-full sm:px-5"
        >
          <PlusIcon className="mr-1.5 inline size-4 align-[-0.2em]" />
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
              <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-line p-8 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-xl text-accent" aria-hidden>
                  □
                </div>
                <h3 className="text-sm font-semibold text-ink">
                  ยังไม่มีบริการจอง
                </h3>
                <p className="mt-1 text-xs text-muted">
                  สร้างบริการจองเพื่อรับนัดหมายจากลูกค้า
                </p>
                <Link
                  href="/dashboard/bookings/new"
                  className="primary-button mt-6 inline-block"
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
              <BookingRow
                key={booking.id}
                booking={{
                  ...booking,
                  status: booking.status as "confirmed" | "cancelled",
                  services: booking.services as unknown as { name: string } | null,
                }}
              />
            ))}
            {(!bookings || bookings.length === 0) && (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-line p-8 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-xl text-accent" aria-hidden>
                  □
                </div>
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
