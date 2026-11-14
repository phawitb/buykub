"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BRAND_DOMAIN, shopUrl } from "@/lib/brand";
import { createClient } from "@/lib/supabase/client";
import { invalidatePublicCatalog, CATALOG_REFRESH_WARNING } from "@/lib/storefront/invalidate";
import { ProductCard } from "@/features/storefront/ProductCard";
import { ProductGrid } from "@/features/storefront/ProductGrid";
import { DEFAULT_COVERS, getShopCover } from "@/lib/storefront/covers";
import { Storefront, type ShopAppearance } from "@/features/storefront/Storefront";
import { ShopEditorDialog } from "./ShopEditorDialog";
import { ShopIcon, shopIconButton } from "./ShopIcon";
import { ProductActions } from "./ProductActions";
import type { ProductListItem } from "./ProductRow";
import { ShareButton } from "@/app/[slug]/ShareButton";
import { ShopImageUploader } from "../settings/ShopImageUploader";

type Shop = ShopAppearance & { id: string; published?: boolean };
type Product = ProductListItem & { availableStock?: number };
const RESERVED_SLUGS = new Set(["dashboard", "learn", "login", "auth", "api", "checkout", "privacy", "terms", "_next"]);
type EditingSection = "create" | "name" | "bio" | "avatar" | "cover";
const EDITOR_COPY: Record<EditingSection, { title: string; description: string }> = {
  create: { title: "สร้างร้านของคุณ", description: "เริ่มจากชื่อร้านและลิงก์ แล้วแต่งหน้าร้านได้ทันที" },
  name: { title: "แก้ไขชื่อร้าน", description: "ชื่อและลิงก์ที่ลูกค้าจะใช้ค้นหาร้านของคุณ" },
  bio: { title: "แก้ไขคำแนะนำร้าน", description: "เล่าให้ลูกค้ารู้จักร้านของคุณสั้น ๆ" },
  avatar: { title: "เปลี่ยนรูปโปรไฟล์", description: "ใช้รูปตัวเองหรือโลโก้ที่ทำให้ลูกค้าจำร้านได้" },
  cover: { title: "เปลี่ยนรูปปก", description: "อัปโหลดภาพของคุณ หรือสุ่มจากภาพธรรมชาติที่เตรียมไว้" },
};

export function MyShop({ initial, userId, products, desiredSlug = "", saveAppearance }: {
  initial: Shop | null;
  userId: string;
  products: Product[];
  desiredSlug?: string;
  saveAppearance?: (payload: ShopAppearance) => Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [persistedSlug, setPersistedSlug] = useState(initial?.slug ?? "");
  const [shopId, setShopId] = useState(initial?.id ?? null);
  const [mode, setMode] = useState<"manage" | "customer">("manage");
  const [editing, setEditing] = useState<EditingSection | null>(initial ? null : "create");
  const [slug, setSlug] = useState(initial?.slug ?? desiredSlug.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  const [name, setName] = useState(initial?.name ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? null);
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url ?? null);
  const [accentColor] = useState(initial?.accent_color ?? "#f97316");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const draftKey = `buykub:appearance-draft:${userId}:${initial?.id ?? "new"}`;
  const hydrated = useRef(false);
  const [baseline, setBaseline] = useState(JSON.stringify({ slug, name, bio, avatar_url: avatarUrl, cover_url: coverUrl, accent_color: accentColor }));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = sessionStorage.getItem(draftKey);
        if (stored) {
          const draft = JSON.parse(stored);
          if (typeof draft.slug === "string" && typeof draft.name === "string" && typeof draft.bio === "string" && typeof draft.accent_color === "string" && (draft.avatar_url === null || typeof draft.avatar_url === "string") && (draft.cover_url === null || typeof draft.cover_url === "string")) {
            setSlug(draft.slug); setName(draft.name); setBio(draft.bio);
            setAvatarUrl(draft.avatar_url); setCoverUrl(draft.cover_url);
          }
        }
      } catch { /* The editor remains usable when browser storage is unavailable. */ }
      hydrated.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    const current = JSON.stringify({ slug, name, bio, avatar_url: avatarUrl, cover_url: coverUrl, accent_color: accentColor });
    try {
      if (current === baseline) sessionStorage.removeItem(draftKey);
      else sessionStorage.setItem(draftKey, current);
    } catch { /* Saving to the server does not depend on draft storage. */ }
  }, [slug, name, bio, avatarUrl, coverUrl, accentColor, draftKey, baseline]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null); setSaved(false);
    const savedAppearance = JSON.parse(baseline) as ShopAppearance;
    const payload: ShopAppearance = editing === "create"
      ? { slug: slug.trim(), name: name.trim(), bio: bio.trim(), avatar_url: avatarUrl, cover_url: coverUrl, accent_color: accentColor }
      : {
        ...savedAppearance,
        ...(editing === "name" ? { slug: slug.trim(), name: name.trim() } : {}),
        ...(editing === "bio" ? { bio: bio.trim() } : {}),
        ...(editing === "avatar" ? { avatar_url: avatarUrl } : {}),
        ...(editing === "cover" ? { cover_url: coverUrl } : {}),
      };
    if (!payload.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
      setError("กรอกชื่อร้านและ URL ร้านด้วยตัวอักษรอังกฤษ ตัวเลข หรือขีดกลาง");
      return;
    }
    if (RESERVED_SLUGS.has(payload.slug)) {
      setError("URL นี้สงวนไว้สำหรับระบบ กรุณาเลือก URL ร้านอื่น"); return;
    }
    setSaving(true);
    try {
      let id = shopId;
      if (saveAppearance) {
        id = (await saveAppearance(payload)).id;
      } else {
        const supabase = createClient();
        const result = shopId
          ? await supabase.from("shops").update(payload).eq("id", shopId).eq("owner_id", userId).select("id").single()
          : await supabase.from("shops").insert({ ...payload, owner_id: userId }).select("id").single();
        if (result.error) throw result.error;
        id = result.data.id;
      }
      setBaseline(JSON.stringify(payload));
      if (editing === "name" || editing === "create") { setSlug(payload.slug); setName(payload.name); }
      if (editing === "bio" || editing === "create") setBio(payload.bio ?? "");
      setShopId(id); setPersistedSlug(payload.slug); setSaved(true); setEditing(null);
      if (!(await invalidatePublicCatalog())) setError(CATALOG_REFRESH_WARNING);
      router.refresh();
    } catch (saveError) {
      const message = saveError && typeof saveError === "object" && "message" in saveError ? String(saveError.message) : "กรุณาลองอีกครั้ง";
      setError(message.includes("duplicate") ? "ลิงก์นี้ถูกใช้แล้ว" : message);
    } finally { setSaving(false); }
  }

  const appearance: ShopAppearance = { slug, name, bio, avatar_url: avatarUrl, cover_url: coverUrl, accent_color: accentColor };
  const visibleProducts = mode === "customer" ? products.filter((product) => product.published) : products;
  const managing = mode === "manage";
  const hasUnsavedChanges = JSON.stringify(appearance) !== baseline;

  return (
    <div className="w-full">
      <h1 className="sr-only">ร้านค้าของฉัน</h1>
      {shopId && <div role="group" aria-label="เครื่องมือหน้าร้าน" className="flex min-h-14 items-center justify-between gap-2 border-b border-line bg-paper px-4 py-2 sm:px-8 lg:px-12">
        <div className="inline-flex min-w-0 items-center divide-x divide-line overflow-hidden rounded-lg border border-line" role="group" aria-label="มุมมองหน้าร้าน">
          <button type="button" aria-pressed={managing} onClick={() => setMode("manage")} className={`h-9 whitespace-nowrap px-3 text-xs font-medium transition focus-visible:-outline-offset-2 sm:px-4 ${managing ? "bg-paper-dim text-ink" : "bg-paper text-muted hover:text-ink"}`}>จัดการร้าน</button>
          <button type="button" aria-pressed={!managing} disabled={avatarUploading || coverUploading || saving} onClick={() => setMode("customer")} className={`h-9 whitespace-nowrap px-3 text-xs font-medium transition focus-visible:-outline-offset-2 disabled:opacity-50 sm:px-4 ${!managing ? "bg-paper-dim text-ink" : "bg-paper text-muted hover:text-ink"}`}>มุมมองลูกค้า</button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ShareButton url={shopUrl(persistedSlug)} title={name || "ร้านของฉัน"} />
          <Link href={shopUrl(persistedSlug)} target="_blank" rel="noopener noreferrer" aria-label="เปิดหน้าร้านจริง" title="เปิดหน้าร้านจริง" className="inline-flex size-9 items-center justify-center rounded-lg border border-line bg-paper text-muted transition hover:bg-paper-dim hover:text-ink"><ShopIcon name="external" /></Link>
        </div>
      </div>}
      {!managing && hasUnsavedChanges && <p className="px-5 py-3 text-sm text-muted sm:px-8 lg:px-12">มีการแก้ไขที่ยังไม่ได้บันทึก — ตัวอย่างนี้แสดงร่างล่าสุด บันทึกหน้าร้านเพื่อให้ลูกค้าเห็นการเปลี่ยนแปลง</p>}
      {initial?.published === false && !managing && <p className="px-5 py-3 text-sm text-muted sm:px-8 lg:px-12">ร้านยังไม่เผยแพร่ — นี่เป็นตัวอย่างหน้าร้าน ลูกค้ายังไม่สามารถเข้าชมได้</p>}
      {error && !editing && <p role="alert" className="px-5 py-3 text-sm text-red-600 sm:px-8 lg:px-12">{error}</p>}
      {saved && managing && <p role="status" className="px-5 py-3 text-sm text-emerald-700 sm:px-8 lg:px-12">บันทึกหน้าร้านสำเร็จ</p>}
      {managing && editing && <ShopEditorDialog key={editing} busy={saving || avatarUploading || coverUploading} {...EDITOR_COPY[editing]} onClose={() => setEditing(null)}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {(editing === "create" || editing === "name") && <div className="space-y-4">
            <div>
              <label htmlFor="shop-name" className="mb-1.5 block text-xs font-medium text-ink-soft">ชื่อร้าน</label>
              <input id="shop-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="ชื่อร้านของคุณ" className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink" />
            </div>
            <div>
              <label htmlFor="shop-slug" className="mb-1.5 block text-xs font-medium text-ink-soft">URL ร้าน</label>
              <div className="flex items-center gap-1 rounded-lg border border-line bg-paper px-3.5 focus-within:border-ink">
                <span className="text-sm text-muted">{BRAND_DOMAIN}/</span>
                <input id="shop-slug" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="your-store" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none" />
              </div>
            </div>
          </div>}
          {(editing === "create" || editing === "bio") && <div>
            <label htmlFor="shop-bio" className="mb-1.5 block text-xs font-medium text-ink-soft">แนะนำร้าน</label>
            <textarea id="shop-bio" value={bio} onChange={(event) => setBio(event.target.value.slice(0, 160))} maxLength={160} rows={4} placeholder="บอกลูกค้าเกี่ยวกับร้านของคุณ..." className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink" />
            <p className="mt-1 text-right text-xs text-muted">{bio.length}/160</p>
          </div>}
          {editing === "avatar" && <ShopImageUploader kind="avatar" userId={userId} value={avatarUrl} onUploaded={setAvatarUrl} onBusyChange={setAvatarUploading} />}
          {editing === "cover" && <div>
            <ShopImageUploader kind="cover" userId={userId} value={coverUrl} onUploaded={setCoverUrl} onBusyChange={setCoverUploading} />
            <button type="button" disabled={coverUploading || saving} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-ink-soft hover:bg-paper-dim disabled:opacity-50" onClick={() => {
              const currentCover = getShopCover({ slug, cover_url: coverUrl });
              const alternatives = DEFAULT_COVERS.filter((cover) => cover.path !== currentCover);
              setCoverUrl(alternatives[Math.floor(Math.random() * alternatives.length)].path);
            }}><ShopIcon name="image" /> สุ่มภาพปกธรรมชาติ</button>
          </div>}
          <div className="flex flex-wrap gap-3 border-t border-line pt-5">
            <button type="submit" disabled={saving || avatarUploading || coverUploading} className="primary-button disabled:opacity-60">{saving ? "กำลังบันทึก..." : shopId ? "บันทึกหน้าร้าน" : "สร้างร้าน"}</button>
            <button type="button" disabled={avatarUploading || coverUploading || saving} onClick={() => setEditing(null)} className="secondary-button">กลับไปหน้าร้าน</button>
          </div>
        </form>
      </ShopEditorDialog>}
      <section aria-label="หน้าร้าน" className="w-full bg-paper">
        <Storefront titleAs="h2" shop={appearance} publicSlug={shopId ? persistedSlug : null} productCount={visibleProducts.length}
          coverActions={managing && <button type="button" aria-label="เปลี่ยนรูปปก" title="เปลี่ยนรูปปก" onClick={() => setEditing("cover")} className="group absolute inset-0 h-full w-full cursor-pointer transition hover:bg-black/5 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"><span className={`absolute bottom-4 right-5 sm:right-8 lg:right-12 ${shopIconButton}`}><ShopIcon name="image" /></span></button>}
          avatarActions={managing && <button type="button" aria-label="เปลี่ยนรูปโปรไฟล์" title="เปลี่ยนรูปโปรไฟล์" onClick={() => setEditing("avatar")} className="group absolute inset-0 flex h-full w-full items-end justify-center rounded-full pb-1 transition hover:bg-black/15 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"><span className="flex items-center gap-1 rounded-full bg-paper/95 px-1.5 py-0.5 text-[9px] font-medium text-ink shadow-lift-1"><ShopIcon name="image" /></span></button>}
          nameContent={managing ? <button type="button" aria-label="แก้ไขชื่อร้าน" title="แก้ไขชื่อร้าน" onClick={() => setEditing("name")} className="group inline-flex max-w-full items-center gap-2 rounded-lg text-left transition hover:bg-paper-dim focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"><span className="break-words">{name || "ตั้งชื่อร้านของคุณ"}</span><span className="shrink-0 text-muted/60 group-hover:text-ink"><ShopIcon name="edit" /></span></button> : undefined}
          bioContent={managing ? <button type="button" aria-label="แก้ไขคำแนะนำร้าน" title="แก้ไขคำแนะนำร้าน" onClick={() => setEditing("bio")} className="group inline-flex max-w-full items-start gap-2 rounded-lg py-1 text-left transition hover:bg-paper-dim focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"><span className="whitespace-pre-line break-words">{bio || "เพิ่มคำแนะนำร้าน"}</span><span className="mt-0.5 shrink-0 text-muted/60 group-hover:text-ink"><ShopIcon name="edit" /></span></button> : undefined}
          productActions={managing && shopId ? <Link prefetch={false} scroll={false} href="/dashboard/products/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-paper shadow-lift-1 transition hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"><ShopIcon name="plus" /> เพิ่มสินค้า</Link> : undefined}>
          {visibleProducts.length ? <ProductGrid>{visibleProducts.map((product) => <div key={product.id} role="listitem" className="relative min-w-0">
            <ProductCard shopSlug={persistedSlug || slug} product={{ name: product.name, slug: product.slug || `product-${product.id.slice(0, 8)}`, category: product.category, priceCents: product.price_cents, comparePriceCents: product.compare_price_cents, thumbnailUrl: product.thumbnailUrl, deliveryType: product.delivery_type === "key" ? "key" : product.delivery_type === "course" ? "course" : "file", availableStock: product.availableStock }} />
            {managing && <>
              <div className="absolute right-3 top-3 flex gap-2">
                <Link prefetch={false} scroll={false} href={`/dashboard/products/${product.id}/edit`} aria-label={`แก้ไขสินค้า ${product.name}`} title="แก้ไขสินค้า" className={shopIconButton}><ShopIcon name="edit" /></Link>
                {product.delivery_type === "course" && <Link href={`/dashboard/products/${product.id}/lessons`} aria-label={`จัดการบทเรียน ${product.name}`} title="จัดการบทเรียน" className={shopIconButton}><ShopIcon name="book" /></Link>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                <span className={`inline-flex items-center gap-1.5 text-xs ${product.published ? "text-emerald-700" : "text-muted"}`}><span className={`size-1.5 rounded-full ${product.published ? "bg-emerald-600" : "bg-muted"}`} />{product.published ? "เผยแพร่แล้ว" : "แบบร่าง"}</span>
                <ProductActions compact productId={product.id} shopId={product.shop_id} productName={product.name} published={product.published} assets={product.assets} />
              </div>
            </>}
          </div>)}</ProductGrid> : <div className="rounded-2xl border border-dashed border-line py-12 text-center"><p className="text-sm font-semibold text-ink">ร้านนี้ยังไม่มีสินค้า</p><p className="mt-1 text-xs text-muted">{managing ? "เพิ่มสินค้าชิ้นแรกเพื่อเริ่มขาย" : "กลับมาเช็กใหม่เร็ว ๆ นี้"}</p></div>}
        </Storefront>
      </section>
    </div>
  );
}
