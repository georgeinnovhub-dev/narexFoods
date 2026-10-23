"use client";

/** Menu management: products (variants, add-ons, images, schedule, SEO) + categories. */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ImagePlus,
  Layers,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { apiSend, formatGHS } from "@/lib/client";
import type { CategoryDTO, ProductDTO, ProductVariantDTO } from "@/lib/types";
import { useAdminApi } from "@/components/admin/admin-context";
import {
  ConfirmDialog,
  EmptyState,
  errMessage,
  PesewasInput,
  SkeletonRows,
  slugify,
  uploadImage,
} from "@/components/admin/admin-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Row {
  key: string;
  id?: string;
  name: string;
  price: number;
  available: boolean;
}

function toRows(list: ProductVariantDTO[]): Row[] {
  return list.map((v) => ({ key: v.id, id: v.id, name: v.name, price: v.price, available: v.available }));
}

export function MenuModule() {
  const { get } = useAdminApi();
  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [categories, setCategories] = useState<CategoryDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [prodRes, catRes] = await Promise.all([
      get<{ products: ProductDTO[] }>("/api/admin/products?includeArchived=1"),
      get<{ categories: CategoryDTO[] }>("/api/admin/categories"),
    ]);
    if (prodRes) setProducts(prodRes.products);
    if (catRes) setCategories(catRes.categories);
    setLoading(false);
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [prodRes, catRes] = await Promise.all([
        get<{ products: ProductDTO[] }>("/api/admin/products?includeArchived=1"),
        get<{ categories: CategoryDTO[] }>("/api/admin/categories"),
      ]);
      if (!cancelled) {
        if (prodRes) setProducts(prodRes.products);
        if (catRes) setCategories(catRes.categories);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  return (
    <Tabs defaultValue="products" className="space-y-4">
      <TabsList>
        <TabsTrigger value="products" className="gap-2"><UtensilsCrossed className="h-4 w-4" /> Products</TabsTrigger>
        <TabsTrigger value="categories" className="gap-2"><Layers className="h-4 w-4" /> Categories</TabsTrigger>
      </TabsList>
      <TabsContent value="products">
        <ProductsTab products={products} categories={categories} loading={loading} onChanged={load} />
      </TabsContent>
      <TabsContent value="categories">
        <CategoriesTab categories={categories} loading={loading} onChanged={load} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------- Products ----------------

function ProductsTab({
  products,
  categories,
  loading,
  onChanged,
}: {
  products: ProductDTO[] | null;
  categories: CategoryDTO[] | null;
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ProductDTO | "new" | null>(null);
  const [archiving, setArchiving] = useState<ProductDTO | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (!showArchived && p.archived) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.categoryName ?? "").toLowerCase().includes(q);
    });
  }, [products, search, showArchived]);

  async function toggleAvailable(p: ProductDTO, available: boolean) {
    setBusyId(p.id);
    const res = await sendProduct({ ...p, available });
    setBusyId(null);
    if (res) {
      toast.success(`${p.name} is now ${available ? "available" : "unavailable"}.`);
      await onChanged();
    }
  }

  async function restore(p: ProductDTO) {
    setBusyId(p.id);
    const res = await sendProduct({ ...p, archived: false });
    setBusyId(null);
    if (res) {
      toast.success(`${p.name} restored to the live menu.`);
      await onChanged();
    }
  }

  async function archive() {
    if (!archiving) return;
    const res = await archiveProductById(archiving.id);
    if (res !== null) {
      toast.success(`${archiving.name} archived.`);
      setArchiving(null);
      await onChanged();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu…" className="pl-9" aria-label="Search products" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label="Show archived products" />
          Show archived
        </label>
        <Button onClick={() => setEditing("new")} className="bg-forest text-cream hover:bg-[#23503E]">
          <Plus className="h-4 w-4" /> Add product
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {loading && !products ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : filtered.length === 0 ? (
          <div className="p-4"><EmptyState icon={PackageOpen} title="No products" body="Add your first dish to start selling." /></div>
        ) : (
          <div className="max-h-[68vh] overflow-auto">
            <Table className="min-w-[860px]">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Add-ons</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-center">Available</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const minPrice = Math.min(...p.variants.map((v) => v.price), Number.MAX_SAFE_INTEGER);
                  return (
                    <TableRow key={p.id} className={cn(p.archived && "opacity-60")}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {p.images[0] ? (
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border">
                              <img src={p.images[0]} alt={p.altText || p.name} className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="truncate text-xs text-muted-foreground">from {formatGHS(minPrice === Number.MAX_SAFE_INTEGER ? 0 : minPrice)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.categoryName ?? "—"}</TableCell>
                      <TableCell>
                        {p.variants.map((v) => (
                          <span key={v.id} className={cn("mr-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs", !v.available && "line-through opacity-60")}>
                            {v.name} {formatGHS(v.price)}
                          </span>
                        ))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.addons.length > 0 ? `${p.addons.length} option${p.addons.length === 1 ? "" : "s"}` : "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.featured ? <Badge className="bg-forest text-cream">Featured</Badge> : null}
                          {p.bestSeller ? <Badge className="bg-gold text-forest">Best seller</Badge> : null}
                          {p.soldOut ? <Badge variant="destructive">Sold out</Badge> : null}
                          {p.archived ? <Badge variant="outline">Archived</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={p.available && !p.archived}
                          disabled={busyId === p.id || p.archived}
                          onCheckedChange={(v) => void toggleAvailable(p, v)}
                          aria-label={`Toggle availability for ${p.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {p.archived ? (
                            <Button variant="ghost" size="icon" aria-label={`Restore ${p.name}`} disabled={busyId === p.id} onClick={() => void restore(p)}>
                              <ArchiveRestore className="h-4 w-4 text-green-700" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" aria-label={`Archive ${p.name}`} onClick={() => setArchiving(p)}>
                              <Archive className="h-4 w-4 text-red-700" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ProductFormDialog
        open={editing !== null}
        product={editing === "new" ? null : editing}
        categories={categories ?? []}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await onChanged();
        }}
      />

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={archiving ? `Archive “${archiving.name}”?` : "Archive product?"}
        description="It disappears from the storefront immediately, but past orders keep their history. You can restore it later."
        confirmLabel="Archive"
        destructive
        onConfirm={() => void archive()}
      />
    </div>
  );
}

async function sendProduct(p: ProductDTO): Promise<ProductDTO | null> {
  const payload = {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    categoryId: p.categoryId,
    images: p.images,
    altText: p.altText,
    prepMinutes: p.prepMinutes,
    featured: p.featured,
    bestSeller: p.bestSeller,
    available: p.available,
    soldOut: p.soldOut,
    archived: p.archived,
    sortOrder: p.sortOrder,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    variants: p.variants.map((v) => ({ id: v.id, name: v.name, price: v.price, available: v.available })),
    addons: p.addons.map((a) => ({ id: a.id, name: a.name, price: a.price, available: a.available })),
  };
  return apiSend<{ product: ProductDTO }>("/api/admin/products", "PUT", payload)
    .then((r) => r.product)
    .catch((err: unknown) => {
      toast.error(errMessage(err));
      return null;
    });
}

async function archiveProductById(id: string): Promise<unknown> {
  return apiSend(`/api/admin/products?id=${encodeURIComponent(id)}`, "DELETE").catch((err: unknown) => {
    toast.error(errMessage(err));
    return null;
  });
}

// ---------------- Product form ----------------

function ProductFormDialog({
  open,
  product,
  categories,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  product: ProductDTO | null;
  categories: CategoryDTO[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const { send } = useAdminApi();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  // form fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [prepMinutes, setPrepMinutes] = useState(20);
  const [sortOrder, setSortOrder] = useState(0);
  const [featured, setFeatured] = useState(false);
  const [bestSeller, setBestSeller] = useState(false);
  const [available, setAvailable] = useState(true);
  const [soldOut, setSoldOut] = useState(false);
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableTo, setAvailableTo] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [altText, setAltText] = useState("");
  const [variants, setVariants] = useState<Row[]>([]);
  const [addons, setAddons] = useState<Row[]>([]);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoOpen, setSeoOpen] = useState(false);

  // Re-initialize the form whenever the editor opens for a different product.
  const [initKey, setInitKey] = useState<string | null>(null);
  const initKeyNow = open ? (product?.id ?? "new") : null;
  if (initKeyNow !== initKey) {
    setInitKey(initKeyNow);
    if (initKeyNow !== null) {
      setSlugTouched(product !== null);
      setName(product?.name ?? "");
      setSlug(product?.slug ?? "");
      setDescription(product?.description ?? "");
      setCategoryId(product?.categoryId ?? "");
      setPrepMinutes(product?.prepMinutes ?? 20);
      setSortOrder(product?.sortOrder ?? 0);
      setFeatured(product?.featured ?? false);
      setBestSeller(product?.bestSeller ?? false);
      setAvailable(product?.available ?? true);
      setSoldOut(product?.soldOut ?? false);
      setAvailableFrom("");
      setAvailableTo("");
      setImages(product?.images ?? []);
      setImageUrlDraft("");
      setAltText(product?.altText ?? "");
      setVariants(product ? toRows(product.variants) : [{ key: `v-${Date.now()}`, name: "Regular", price: 0, available: true }]);
      setAddons(product ? toRows(product.addons) : []);
      setSeoTitle(product?.seoTitle ?? "");
      setSeoDescription(product?.seoDescription ?? "");
      setSeoOpen(false);
    }
  }

  function updateRow(list: Row[], key: string, patch: Partial<Row>): Row[] {
    return list.map((r) => (r.key === key ? { ...r, ...patch } : r));
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    setUploading(false);
    if (url) setImages((imgs) => [...imgs, url]);
  }

  async function save() {
    const trimmedName = name.trim();
    const finalSlug = slugify(slug || trimmedName);
    if (trimmedName.length < 2) return toast.error("Product name is too short.");
    if (!/^[a-z0-9-]{2,}$/.test(finalSlug)) return toast.error("Slug may only contain lowercase letters, numbers and dashes.");
    const cleanVariants = variants.filter((v) => v.name.trim());
    if (cleanVariants.length === 0) return toast.error("At least one variant (portion) is required.");
    if (cleanVariants.some((v) => v.price === null || v.price === undefined || v.price < 0)) return toast.error("Every variant needs a price.");
    const cleanAddons = addons.filter((a) => a.name.trim() && a.price !== null && a.price !== undefined);

    setSaving(true);
    const payload = {
      ...(product ? { id: product.id } : {}),
      name: trimmedName,
      slug: finalSlug,
      description: description.trim(),
      categoryId: categoryId || null,
      images,
      altText: altText.trim(),
      prepMinutes: Math.max(1, Math.min(240, Math.round(prepMinutes) || 20)),
      featured,
      bestSeller,
      available,
      soldOut,
      archived: product?.archived ?? false,
      ...(availableFrom ? { availableFrom } : {}),
      ...(availableTo ? { availableTo } : {}),
      sortOrder: Math.round(sortOrder) || 0,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      variants: cleanVariants.map((v) => ({ ...(v.id ? { id: v.id } : {}), name: v.name.trim(), price: v.price, available: v.available })),
      addons: cleanAddons.map((a) => ({ ...(a.id ? { id: a.id } : {}), name: a.name.trim(), price: a.price, available: a.available })),
    };
    const res = await send<{ product: ProductDTO }>("/api/admin/products", product ? "PUT" : "POST", payload);
    setSaving(false);
    if (res?.product) {
      toast.success(product ? "Product updated." : "Product added to the menu.");
      await onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{product ? `Edit ${product.name}` : "New product"}</DialogTitle>
          <DialogDescription>Variants and add-ons are replaced wholesale on save.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-slug">Slug</Label>
              <Input id="p-slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} placeholder="jollof-rice" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-prep">Prep minutes</Label>
              <Input id="p-prep" type="number" min={1} max={240} value={prepMinutes} onChange={(e) => setPrepMinutes(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sort">Sort order</Label>
              <Input id="p-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-sm"><Switch checked={available} onCheckedChange={setAvailable} /> Available</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={soldOut} onCheckedChange={setSoldOut} /> Sold out</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={featured} onCheckedChange={setFeatured} /> Featured</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={bestSeller} onCheckedChange={setBestSeller} /> Best seller</label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-from">Available from (optional)</Label>
              <Input id="p-from" type="time" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-to">Available until (optional)</Label>
              <Input id="p-to" type="time" value={availableTo} onChange={(e) => setAvailableTo(e.target.value)} />
            </div>
          </div>

          {/* Images */}
          <div className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <Label>Images ({images.length}/10)</Label>
              <div className="flex gap-2">
                <Input
                  value={imageUrlDraft}
                  onChange={(e) => setImageUrlDraft(e.target.value)}
                  placeholder="/images/… or https://…"
                  className="h-8 w-44 text-xs"
                  aria-label="Image URL"
                />
                <Button type="button" variant="outline" size="sm" disabled={!imageUrlDraft.trim()} onClick={() => { setImages((xs) => [...xs, imageUrlDraft.trim()]); setImageUrlDraft(""); }}>
                  Add URL
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? "Uploading…" : <><ImagePlus className="h-4 w-4" /> Upload</>}
                </Button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void handleFile(e)} aria-label="Upload product image" />
              </div>
            </div>
            {images.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={`${img}-${i}`} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                    <img src={img} alt={`Product image ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove image ${i + 1}`}
                      className="absolute right-0.5 top-0.5 rounded bg-red-600 p-0.5 text-white opacity-90 hover:opacity-100"
                      onClick={() => setImages((xs) => xs.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No images yet — the storefront shows a placeholder.</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="p-alt" className="text-xs">Alt text (accessibility)</Label>
              <Input id="p-alt" value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="A plate of NAREX jollof rice" />
            </div>
          </div>

          {/* Variants */}
          <div className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <Label>Portion variants (at least one)</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setVariants((vs) => [...vs, { key: `v-${Date.now()}-${Math.random()}`, name: "", price: 0, available: true }])}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {variants.map((v) => (
                <div key={v.key} className="grid grid-cols-[1fr_130px_auto] items-center gap-2">
                  <Input value={v.name} onChange={(e) => setVariants((vs) => updateRow(vs, v.key, { name: e.target.value }))} placeholder="e.g. Single / Family pack" aria-label="Variant name" />
                  <PesewasInput value={v.price} onChange={(pesewas) => setVariants((vs) => updateRow(vs, v.key, { price: pesewas ?? 0 }))} />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Checkbox checked={v.available} onCheckedChange={(c) => setVariants((vs) => updateRow(vs, v.key, { available: c === true }))} /> live
                    </label>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove variant" disabled={variants.length <= 1} onClick={() => setVariants((vs) => vs.filter((r) => r.key !== v.key))}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add-ons */}
          <div className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <Label>Add-ons (optional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddons((as) => [...as, { key: `a-${Date.now()}-${Math.random()}`, name: "", price: 0, available: true }])}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {addons.length === 0 ? (
              <p className="text-xs text-muted-foreground">No add-ons — customers order the plain variant.</p>
            ) : (
              <div className="space-y-2">
                {addons.map((a) => (
                  <div key={a.key} className="grid grid-cols-[1fr_130px_auto] items-center gap-2">
                    <Input value={a.name} onChange={(e) => setAddons((as) => updateRow(as, a.key, { name: e.target.value }))} placeholder="e.g. Extra egg" aria-label="Add-on name" />
                    <PesewasInput value={a.price} onChange={(pesewas) => setAddons((as) => updateRow(as, a.key, { price: pesewas ?? 0 }))} />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox checked={a.available} onCheckedChange={(c) => setAddons((as) => updateRow(as, a.key, { available: c === true }))} /> live
                      </label>
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove add-on" onClick={() => setAddons((as) => as.filter((r) => r.key !== a.key))}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SEO */}
          <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50">
              SEO (optional)
              <ChevronDown className={cn("h-4 w-4 transition-transform", seoOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-seo-title">SEO title</Label>
                <Input id="p-seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={160} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-seo-desc">SEO description</Label>
                <Textarea id="p-seo-desc" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} maxLength={300} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">
            {saving ? "Saving…" : product ? "Save changes" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Categories ----------------

function CategoriesTab({
  categories,
  loading,
  onChanged,
}: {
  categories: CategoryDTO[] | null;
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const { send } = useAdminApi();
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  async function add() {
    const trimmed = name.trim();
    if (trimmed.length < 2) return toast.error("Category name is too short.");
    setSaving(true);
    const res = await send("/api/admin/categories", "POST", { name: trimmed, sortOrder: Math.round(sortOrder) || 0 });
    setSaving(false);
    if (res !== null) {
      toast.success(`Category “${trimmed}” saved.`);
      setName("");
      setSortOrder(0);
      await onChanged();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-base">Add category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Soups & Swallow" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-sort">Sort order</Label>
            <Input id="cat-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </div>
          <Button onClick={() => void add()} disabled={saving} className="w-full bg-forest text-cream hover:bg-[#23503E]">
            {saving ? "Saving…" : "Save category"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-display text-base">Current categories</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !categories ? (
            <SkeletonRows rows={4} />
          ) : (categories ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-2 pr-3">
                {(categories ?? []).map((c, i) => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5">
                      <span className="font-medium">{c.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">/{c.slug} · order {c.sortOrder}</span>
                    </div>
                    {i < (categories?.length ?? 0) - 1 ? null : <Separator className="mt-2 bg-transparent" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
