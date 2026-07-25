import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BuyButton } from "./BuyButton";
import { BookButton } from "./BookButton";
import { ShareButton } from "./ShareButton";

export default async function ShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, slug, name, bio, avatar_url, cover_url, accent_color")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!shop) {
    return <NotFoundCard slug={slug} />;
  }

  const [{ data: products }, { data: services }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, price_cents, compare_price_cents")
      .eq("shop_id", shop.id)
      .eq("published", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("services")
      .select("id, name, description, price_cents, duration_minutes")
      .eq("shop_id", shop.id)
      .eq("published", true)
      .order("created_at", { ascending: true }),
  ]);

  await supabase.from("shop_views").insert({ shop_id: shop.id });

  const hasListings = (products?.length ?? 0) > 0 || (services?.length ?? 0) > 0;

  return (
    <div className="min-h-screen">
      <div
        className="relative h-40 w-full sm:h-56"
        style={{ backgroundColor: shop.cover_url ? undefined : "var(--color-paper-dim)" }}
      >
        {shop.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.cover_url} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute right-4 top-4">
          <ShareButton />
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6">
        <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-full border-4 border-paper bg-ink text-2xl font-bold text-paper">
          {shop.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.avatar_url}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            shop.name.slice(0, 1)
          )}
        </div>

        <h1 className="mt-4 text-2xl font-bold text-ink">{shop.name}</h1>
        {shop.bio && <p className="mt-2 max-w-sm text-sm text-ink-soft">{shop.bio}</p>}

        <div className="mt-8 space-y-4 pb-16">
          {(services ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-paper p-5"
            >
              <div>
                <p className="text-xs font-medium text-muted">
                  บริการจอง · {s.duration_minutes} นาที
                </p>
                <p className="mt-0.5 font-semibold text-ink">{s.name}</p>
                {s.description && (
                  <p className="mt-1 text-sm text-ink-soft">{s.description}</p>
                )}
                <p className="mt-2 text-sm font-bold text-ink">
                  ฿{(s.price_cents / 100).toLocaleString("th-TH")}
                </p>
              </div>
              <BookButton serviceId={s.id} shopId={shop.id} priceCents={s.price_cents} />
            </div>
          ))}

          {(products ?? []).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-paper p-5"
            >
              <div>
                <p className="font-semibold text-ink">{p.name}</p>
                {p.description && (
                  <p className="mt-1 text-sm text-ink-soft">{p.description}</p>
                )}
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <span className="font-bold text-ink">
                    ฿{(p.price_cents / 100).toLocaleString("th-TH")}
                  </span>
                  {p.compare_price_cents && (
                    <span className="text-muted line-through">
                      ฿{(p.compare_price_cents / 100).toLocaleString("th-TH")}
                    </span>
                  )}
                </p>
              </div>
              <BuyButton productId={p.id} shopId={shop.id} priceCents={p.price_cents} />
            </div>
          ))}

          {!hasListings && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-paper-dim text-2xl text-muted">
                ⌂
              </div>
              <p className="text-sm font-medium text-ink">ร้านนี้ยังไม่มีสินค้า</p>
              <p className="mt-1 text-xs text-muted">กลับมาเช็คใหม่เร็วๆ นี้</p>
            </div>
          )}
        </div>

        <p className="pb-14 text-center text-xs text-muted">
          สร้างด้วย <span className="font-semibold text-ink-soft">Framelink</span> —{" "}
          <Link href="/login" className="underline">
            เปิดร้านฟรี
          </Link>
        </p>
      </div>
    </div>
  );
}

function NotFoundCard({ slug }: { slug: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-paper-dim text-2xl text-muted">
          ⌂
        </div>
        <h1 className="text-xl font-bold text-ink">ไม่พบร้านนี้</h1>
        <p className="mt-2 text-sm text-ink-soft">
          ร้าน &ldquo;{slug}&rdquo; อาจยังไม่ได้เปิด หรือเปลี่ยนชื่อไปแล้ว
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper"
        >
          กลับหน้าแรก
        </Link>
        <p className="mt-6 text-xs text-muted">FRAMELINK</p>
      </div>
    </div>
  );
}
