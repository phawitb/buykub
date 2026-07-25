import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BuyButton } from "./BuyButton";

export default async function ShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, slug, name, bio, avatar_url")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!shop) {
    return <NotFoundCard slug={slug} />;
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, description, price_cents, kind")
    .eq("shop_id", shop.id)
    .eq("published", true)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto min-h-screen max-w-lg px-6 py-14">
      <div className="mb-8 flex justify-center">
        <span className="rounded-full border border-line bg-paper-dim px-4 py-1.5 text-xs text-muted">
          framelink.app/{shop.slug}
        </span>
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ink text-2xl font-bold text-paper">
          {shop.name.slice(0, 1)}
        </div>
        <h1 className="mt-4 text-2xl font-bold text-ink">{shop.name}</h1>
        {shop.bio && <p className="mt-2 max-w-sm text-sm text-ink-soft">{shop.bio}</p>}
      </div>

      <div className="mt-10 space-y-4">
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
              <p className="mt-2 text-sm font-bold text-ink">
                ฿{(p.price_cents / 100).toLocaleString("th-TH")}
              </p>
            </div>
            <BuyButton productId={p.id} shopId={shop.id} priceCents={p.price_cents} />
          </div>
        ))}

        {(!products || products.length === 0) && (
          <p className="text-center text-sm text-muted">ร้านนี้ยังไม่มีสินค้า</p>
        )}
      </div>

      <p className="mt-14 text-center text-xs text-muted">
        Powered by <span className="font-semibold text-ink-soft">Framelink</span>
      </p>
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
