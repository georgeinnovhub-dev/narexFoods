"use client";

/** Website editor: home page (hero slides, story, how-it-works) with preview/rollback + blog management. */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  Eye,
  Globe,
  History,
  ImagePlus,
  Newspaper,
  Pencil,
  Plus,
  RotateCcw,
  Rocket,
  Trash2,
} from "lucide-react";
import { apiSend } from "@/lib/client";
import { useAdminApi } from "@/components/admin/admin-context";
import {
  BlogStatusBadge,
  ConfirmDialog,
  EmptyState,
  errMessage,
  SkeletonRows,
  slugify,
  uploadImage,
  formatDate,
} from "@/components/admin/admin-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeroSlide {
  title: string;
  subtitle: string;
  image: string;
  ctaLabel: string;
  ctaAction: string;
}

interface StoryBlock {
  eyebrow: string;
  title: string;
  body: string;
  image: string;
}

interface StepBlock {
  title: string;
  body: string;
  icon: string;
}

interface HomeData {
  heroSlides: HeroSlide[];
  story: StoryBlock;
  howItWorks: StepBlock[];
}

interface RevisionRow {
  revision: number;
  updatedBy: string;
  createdAt: string;
  data: unknown;
}

interface ContentResponse {
  page: string;
  published: HomeData | null;
  revision: number;
  updatedBy: string | null;
  updatedAt: string | null;
  revisions: RevisionRow[];
}

const EMPTY_HOME: HomeData = {
  heroSlides: [{ title: "", subtitle: "", image: "", ctaLabel: "Order now", ctaAction: "menu" }],
  story: { eyebrow: "Our story", title: "", body: "", image: "" },
  howItWorks: [
    { title: "", body: "", icon: "utensils" },
  ],
};

export function ContentModule() {
  return (
    <Tabs defaultValue="home" className="space-y-4">
      <TabsList>
        <TabsTrigger value="home" className="gap-2"><Globe className="h-4 w-4" /> Home page</TabsTrigger>
        <TabsTrigger value="blog" className="gap-2"><Newspaper className="h-4 w-4" /> Blog</TabsTrigger>
      </TabsList>
      <TabsContent value="home"><HomeEditor /></TabsContent>
      <TabsContent value="blog"><BlogTab /></TabsContent>
    </Tabs>
  );
}

// ---------------- Home editor ----------------

function HomeEditor() {
  const { get, send } = useAdminApi();
  const [published, setPublished] = useState<HomeData | null>(null);
  const [draft, setDraft] = useState<HomeData>(EMPTY_HOME);
  const [meta, setMeta] = useState<{ revision: number; updatedBy: string | null; updatedAt: string | null }>({ revision: 0, updatedBy: null, updatedAt: null });
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [rollbackTo, setRollbackTo] = useState<RevisionRow | null>(null);

  const load = useCallback(async () => {
    const res = await get<ContentResponse>("/api/admin/content?page=home");
    if (res) {
      const pub = res.published;
      setPublished(pub);
      setDraft(pub ?? EMPTY_HOME);
      setMeta({ revision: res.revision, updatedBy: res.updatedBy, updatedAt: res.updatedAt });
      setRevisions(res.revisions);
    }
    setLoading(false);
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<ContentResponse>("/api/admin/content?page=home");
      if (!cancelled) {
        if (res) {
          const pub = res.published;
          setPublished(pub);
          setDraft(pub ?? EMPTY_HOME);
          setMeta({ revision: res.revision, updatedBy: res.updatedBy, updatedAt: res.updatedAt });
          setRevisions(res.revisions);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(published ?? EMPTY_HOME), [draft, published]);

  async function publish() {
    setSaving(true);
    const res = await send<{ success: boolean; revision: number }>("/api/admin/content", "PUT", {
      page: "home",
      data: draft,
      action: "publish",
    });
    setSaving(false);
    setPublishOpen(false);
    if (res !== null) {
      toast.success(`Home page published — revision ${res.revision}.`);
      await load();
    }
  }

  async function rollback() {
    if (!rollbackTo) return;
    const res = await send<{ success: boolean }>("/api/admin/content", "POST", { page: "home", revision: rollbackTo.revision });
    if (res !== null) {
      toast.success(`Rolled back to revision ${rollbackTo.revision}.`);
      setRollbackTo(null);
      await load();
    }
  }

  function updateSlide(i: number, patch: Partial<HeroSlide>) {
    setDraft((d) => ({ ...d, heroSlides: d.heroSlides.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  }

  function updateStep(i: number, patch: Partial<StepBlock>) {
    setDraft((d) => ({ ...d, howItWorks: d.howItWorks.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  }

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><SkeletonRows rows={6} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            Published revision {meta.revision}
            {meta.updatedAt ? <span className="font-normal text-muted-foreground"> · {meta.updatedBy ?? "system"} · {formatDate(meta.updatedAt)}</span> : null}
          </p>
          <p className={cn("text-xs", dirty ? "font-medium text-amber-700" : "text-muted-foreground")}>
            {dirty ? "You have unsaved edits — preview and publish when ready." : "Draft matches the live site."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button onClick={() => setPublishOpen(true)} disabled={!dirty} className="bg-forest text-cream hover:bg-[#23503E]">
            <Rocket className="h-4 w-4" /> Publish changes
          </Button>
        </div>
      </div>

      {/* Hero slides */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-forest">Hero slides ({draft.heroSlides.length}/6)</h3>
          <Button
            variant="outline"
            size="sm"
            disabled={draft.heroSlides.length >= 6}
            onClick={() => setDraft((d) => ({ ...d, heroSlides: [...d.heroSlides, { title: "", subtitle: "", image: "", ctaLabel: "Order now", ctaAction: "menu" }] }))}
          >
            <Plus className="h-4 w-4" /> Add slide
          </Button>
        </div>
        {draft.heroSlides.map((slide, i) => (
          <SlideEditor key={i} index={i} slide={slide} canRemove={draft.heroSlides.length > 1} onChange={(patch) => updateSlide(i, patch)} onRemove={() => setDraft((d) => ({ ...d, heroSlides: d.heroSlides.filter((_, idx) => idx !== i) }))} />
        ))}
      </section>

      {/* Story */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="font-display text-base font-bold text-forest">Our story section</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="st-eyebrow">Eyebrow</Label>
              <Input id="st-eyebrow" value={draft.story.eyebrow} onChange={(e) => setDraft((d) => ({ ...d, story: { ...d.story, eyebrow: e.target.value } }))} placeholder="Since 2015 · Mampong-Akuapem" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-title">Title</Label>
              <Input id="st-title" value={draft.story.title} onChange={(e) => setDraft((d) => ({ ...d, story: { ...d.story, title: e.target.value } }))} placeholder="Good Food. Great Taste. Made with Care." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-body">Body</Label>
              <Textarea id="st-body" value={draft.story.body} onChange={(e) => setDraft((d) => ({ ...d, story: { ...d.story, body: e.target.value } }))} rows={4} />
            </div>
          </div>
          <ImageField
            label="Story image"
            value={draft.story.image}
            onChange={(url) => setDraft((d) => ({ ...d, story: { ...d.story, image: url } }))}
          />
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-forest">How it works</h3>
          <Button variant="outline" size="sm" disabled={draft.howItWorks.length >= 4} onClick={() => setDraft((d) => ({ ...d, howItWorks: [...d.howItWorks, { title: "", body: "", icon: "utensils" }] }))}>
            <Plus className="h-4 w-4" /> Add step
          </Button>
        </div>
        {draft.howItWorks.map((step, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[90px_1fr_1.4fr_auto]">
            <div className="space-y-1.5">
              <Label>Icon key</Label>
              <Input value={step.icon} onChange={(e) => updateStep(i, { icon: e.target.value })} placeholder="utensils" />
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={step.title} onChange={(e) => updateStep(i, { title: e.target.value })} placeholder="Pick your meal" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={step.body} onChange={(e) => updateStep(i, { body: e.target.value })} placeholder="Browse the daily menu and add to your basket." />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="icon" aria-label={`Remove step ${i + 1}`} disabled={draft.howItWorks.length <= 1} onClick={() => setDraft((d) => ({ ...d, howItWorks: d.howItWorks.filter((_, idx) => idx !== i) }))}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </div>
        ))}
      </section>

      {/* Revisions */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="font-display mb-3 flex items-center gap-2 text-base font-bold text-forest">
          <History className="h-4 w-4" aria-hidden="true" /> Revision history
        </h3>
        {revisions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No previous revisions yet — publish to create history.</p>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="space-y-2 pr-3">
              {revisions.map((r) => (
                <div key={r.revision} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <Badge variant="outline" className="border-forest/25 text-forest">rev {r.revision}</Badge>
                  <span className="text-muted-foreground">{r.updatedBy} · {formatDate(r.createdAt)}</span>
                  <Button variant="ghost" size="sm" className="ml-auto text-forest hover:bg-forest/5" onClick={() => setRollbackTo(r)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </section>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Storefront preview (draft)</DialogTitle>
            <DialogDescription>Exactly what customers will see after publish.</DialogDescription>
          </DialogHeader>
          <HomePreview data={draft} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish to the storefront?"
        description="The previous version is kept in revision history and can be restored at any time."
        confirmLabel="Publish now"
        loading={saving}
        onConfirm={() => void publish()}
      />
      <ConfirmDialog
        open={rollbackTo !== null}
        onOpenChange={(o) => !o && setRollbackTo(null)}
        title={rollbackTo ? `Restore revision ${rollbackTo.revision}?` : "Restore?"}
        description="The current live version is archived first, so nothing is lost."
        confirmLabel="Restore"
        onConfirm={() => void rollback()}
      />
    </div>
  );
}

function SlideEditor({
  index,
  slide,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  slide: HeroSlide;
  canRemove: boolean;
  onChange: (patch: Partial<HeroSlide>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-border p-3 lg:grid-cols-[150px_1fr_1fr]">
      <ImageField label={`Slide ${index + 1} image`} value={slide.image} onChange={(url) => onChange({ image: url })} compact />
      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label htmlFor={`hs-title-${index}`}>Title</Label>
          <Input id={`hs-title-${index}`} value={slide.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Authentic Ghanaian flavour" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`hs-sub-${index}`}>Subtitle</Label>
          <Textarea id={`hs-sub-${index}`} value={slide.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} rows={2} placeholder="Cooked fresh in Mampong-Akuapem every day." />
        </div>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor={`hs-cta-${index}`}>CTA label</Label>
            <Input id={`hs-cta-${index}`} value={slide.ctaLabel} onChange={(e) => onChange({ ctaLabel: e.target.value })} placeholder="Order now" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`hs-act-${index}`}>CTA action</Label>
            <Input id={`hs-act-${index}`} value={slide.ctaAction} onChange={(e) => onChange({ ctaAction: e.target.value })} placeholder="menu" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" disabled={!canRemove} onClick={onRemove}>
            <Trash2 className="h-4 w-4" /> Remove slide
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImageField({ label, value, onChange, compact }: { label: string; value: string; onChange: (url: string) => void; compact?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    setUploading(false);
    if (url) onChange(url);
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <Label>{label}</Label>
      {value ? (
        <div className="relative">
          <img src={value} alt={label} className={cn("w-full rounded-lg border border-border object-cover", compact ? "h-24" : "h-40")} />
          <button type="button" aria-label="Remove image" className="absolute right-1.5 top-1.5 rounded bg-red-600 p-1 text-white" onClick={() => onChange("")}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className={cn("flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground", compact ? "h-24" : "h-40")}>
          No image selected
        </div>
      )}
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/images/… (site path)" className="h-8 text-xs" aria-label={`${label} URL`} />
        <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-4 w-4" /> {uploading ? "…" : "Upload"}
        </Button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void handleFile(e)} aria-label={`Upload ${label}`} />
      </div>
      {value && !value.startsWith("/") ? <p className="text-xs text-amber-700">Home page images must be site paths starting with “/” — upload instead of pasting external URLs.</p> : null}
    </div>
  );
}

function HomePreview({ data }: { data: HomeData }) {
  const hero = data.heroSlides[0];
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {/* Mock hero */}
      <div className="relative min-h-[220px] bg-forest px-6 py-10 text-cream">
        {hero?.image ? (
          <>
            <img src={hero.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E241B] via-transparent to-transparent" aria-hidden="true" />
          </>
        ) : null}
        <div className="relative">
          <p className="mb-2 inline-block rounded-full bg-gold/20 px-3 py-1 text-[11px] uppercase tracking-widest text-gold">NAREX Foods</p>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{hero?.title || "Your hero title"}</h2>
          <p className="mt-2 max-w-md text-sm text-cream/80">{hero?.subtitle || "Your hero subtitle appears here."}</p>
          <span className="mt-4 inline-flex items-center rounded-full bg-gold px-4 py-2 text-sm font-semibold text-forest">{hero?.ctaLabel || "Order now"}</span>
        </div>
      </div>
      {/* Mock story */}
      <div className="grid gap-4 bg-cream px-6 py-8 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">{data.story.eyebrow || "Our story"}</p>
          <h3 className="font-display mt-1 text-xl font-bold text-forest">{data.story.title || "Story title"}</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground/75">{data.story.body || "Your story body text renders here."}</p>
        </div>
        {data.story.image ? (
          <img src={data.story.image} alt="" className="h-40 w-full rounded-xl border border-border object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">Story image</div>
        )}
      </div>
      {/* Mock steps */}
      <div className="border-t border-border bg-white px-6 py-8">
        <h3 className="font-display mb-4 text-center text-lg font-bold text-forest">How it works</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {data.howItWorks.map((step, i) => (
            <div key={i} className="rounded-xl border border-border p-3 text-center">
              <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#17362B]/10 font-bold text-forest">{i + 1}</span>
              <p className="text-sm font-semibold">{step.title || `Step ${i + 1}`}</p>
              <p className="mt-1 text-xs text-muted-foreground">{step.body || "Step description."}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Blog ----------------

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  altText: string;
  tags: string[];
  status: string;
  author: string;
  publishedAt: string | null;
  createdAt: string;
}

function BlogTab() {
  const { get } = useAdminApi();
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BlogPost | "new" | null>(null);
  const [deleting, setDeleting] = useState<BlogPost | null>(null);

  const load = useCallback(async () => {
    const res = await get<{ posts: BlogPost[] }>("/api/admin/blog");
    if (res) setPosts(res.posts);
    setLoading(false);
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<{ posts: BlogPost[] }>("/api/admin/blog");
      if (!cancelled) {
        if (res) setPosts(res.posts);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  async function remove() {
    if (!deleting) return;
    try {
      await apiSend(`/api/admin/blog?id=${encodeURIComponent(deleting.id)}`, "DELETE");
      toast.success("Post deleted.");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Stories, recipes and announcements written in markdown.</p>
        <Button onClick={() => setEditing("new")} className="bg-forest text-cream hover:bg-[#23503E]">
          <Plus className="h-4 w-4" /> New post
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {loading && !posts ? (
          <div className="p-4"><SkeletonRows rows={4} /></div>
        ) : (posts ?? []).length === 0 ? (
          <div className="p-4"><EmptyState icon={Newspaper} title="No blog posts yet" /></div>
        ) : (
          <div className="max-h-[62vh] overflow-auto">
            <Table className="min-w-[720px]">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(posts ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <p className="max-w-[260px] truncate font-medium">{p.title}</p>
                      <p className="max-w-[260px] truncate text-xs text-muted-foreground">{p.excerpt || `/${p.slug}`}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.tags.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : p.tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-[11px]">{t}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell><BlogStatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{p.author}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{p.publishedAt ? formatDate(p.publishedAt) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${p.title}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(p)}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(p)}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <BlogEditor open={editing !== null} post={editing === "new" ? null : editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={load} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? `Delete “${deleting.title}”?` : "Delete post?"}
        description="The post is removed permanently."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void remove()}
      />
    </div>
  );
}

function BlogEditor({
  open,
  post,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  post: BlogPost | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const { send } = useAdminApi();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);

  // Re-initialize the form whenever the editor opens for a different target.
  const [initKey, setInitKey] = useState<string | null>(null);
  const initKeyNow = open ? (post?.id ?? "new") : null;
  if (initKeyNow !== initKey) {
    setInitKey(initKeyNow);
    if (initKeyNow !== null) {
      setTitle(post?.title ?? "");
      setSlug(post?.slug ?? "");
      setSlugTouched(post !== null);
      setExcerpt(post?.excerpt ?? "");
      setContent(post?.content ?? "");
      setCoverImage(post?.coverImage ?? null);
      setAltText(post?.altText ?? "");
      setTagsDraft(post?.tags.join(", ") ?? "");
      setStatus(post?.status ?? "draft");
    }
  }

  async function save() {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 2) return toast.error("Post title is too short.");
    const finalSlug = slugify(slug || cleanTitle);
    if (!/^[a-z0-9-]{2,}$/.test(finalSlug)) return toast.error("Slug may only contain lowercase letters, numbers and dashes.");
    const tags = tagsDraft.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
    setSaving(true);
    const payload = {
      title: cleanTitle,
      slug: finalSlug,
      excerpt: excerpt.trim(),
      content,
      coverImage: coverImage ?? null,
      altText: altText.trim(),
      tags,
      status,
    };
    const res = await send("/api/admin/blog", post ? "PUT" : "POST", post ? { id: post.id, ...payload } : payload);
    setSaving(false);
    if (res !== null) {
      toast.success(post ? "Post updated." : "Post created.");
      onOpenChange(false);
      await onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{post ? `Edit “${post.title}”` : "New blog post"}</DialogTitle>
          <DialogDescription>Markdown supported: ## headings, **bold**, lists and links.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-title">Title</Label>
              <Input id="b-title" value={title} onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-slug">Slug</Label>
              <Input id="b-slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-excerpt">Excerpt (shown in lists)</Label>
            <Input id="b-excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={300} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-content">Content (markdown)</Label>
            <Textarea id="b-content" value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="font-mono text-sm" placeholder={"## Jollof, perfected\n\nOur kitchen secret is…" } />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-tags">Tags (comma-separated)</Label>
              <Input id="b-tags" value={tagsDraft} onChange={(e) => setTagsDraft(e.target.value)} placeholder="recipes, jollof, family" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="b-alt">Cover alt text</Label>
              <Input id="b-alt" value={altText} onChange={(e) => setAltText(e.target.value)} />
            </div>
            <CoverPicker value={coverImage} onChange={setCoverImage} />
          </div>
          <Separator />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">{saving ? "Saving…" : post ? "Save changes" : "Create post"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CoverPicker({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    setUploading(false);
    if (url) onChange(url);
  }

  return (
    <div className="space-y-1.5">
      <Label>Cover image</Label>
      <div className="flex items-center gap-2">
        {value ? (
          <>
            <img src={value} alt="Blog cover" className="h-12 w-20 rounded-lg border border-border object-cover" />
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Remove</Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload cover"}
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void handleFile(e)} aria-label="Upload blog cover" />
      </div>
    </div>
  );
}
