"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store/app-store";
import { Eyebrow, Reveal, SafeImage } from "./storefront-lib";
import { ProductCard } from "./product-card";

export function MenuView() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const params = useAppStore((s) => s.params);
  const navigate = useAppStore((s) => s.navigate);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(params.category ?? "all");

  const products = useMemo(() => (bootstrap?.products ?? []).filter((p) => !p.archived), [bootstrap]);

  /* Variety spotlight: each category with a live dish count + hero photo. */
  const varieties = useMemo(() => {
    return (bootstrap?.categories ?? [])
      .map((c) => {
        const inCategory = products.filter((p) => p.categoryId === c.id);
        const hero = inCategory.find((p) => p.images.length > 0 && p.available && !p.soldOut) ?? inCategory[0];
        return { id: c.id, name: c.name, image: hero?.images[0] ?? "", count: inCategory.length };
      })
      .filter((v) => v.count > 0);
  }, [bootstrap, products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchCategory = category === "all" || p.categoryId === category;
      const matchQuery =
        q.length === 0 ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.categoryName ?? "").toLowerCase().includes(q);
      return matchCategory && matchQuery;
    });
  }, [products, category, query]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:py-14">
      <Reveal>
        <Eyebrow>Our kitchen</Eyebrow>
        <h1 className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">The Menu</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          Cooked fresh to order, seasoned by hand, never reheated. Pick a dish, customise your plate, and
          we&apos;ll fire the pot the moment you say go.
        </p>
      </Reveal>

      {/* Variety spotlight — single out a craving */}
      {varieties.length > 0 && (
        <Reveal className="mt-8" delay={0.03}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {varieties.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setCategory(v.id);
                  navigate("menu", { category: v.id });
                }}
                aria-pressed={category === v.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative aspect-[16/8] w-full overflow-hidden bg-muted">
                  <SafeImage
                    src={v.image || undefined}
                    alt={`${v.name} variety`}
                    className="h-full w-full transition-transform duration-500 group-hover:scale-[1.05]"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-forest/75 via-forest/20 to-transparent" aria-hidden="true" />
                  <span className="absolute bottom-2 left-2.5 font-display text-sm font-semibold text-cream drop-shadow">
                    {v.name}
                  </span>
                </div>
                <span className="absolute right-2 top-2 rounded-full bg-cream/95 px-2 py-0.5 text-[10px] font-bold text-forest">
                  {v.count}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setCategory("all");
                navigate("menu");
              }}
              aria-pressed={category === "all"}
              className="group flex min-h-[104px] flex-col items-start justify-center gap-1.5 rounded-2xl border-2 border-dashed border-forest/30 bg-background p-4 text-left transition-colors hover:border-forest hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-display text-sm font-semibold text-forest">Everything, as one</span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                See all dishes together
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </button>
          </div>
        </Reveal>
      )}

      {/* Search + category tabs */}
      <Reveal className="mt-8 space-y-4" delay={0.05}>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dishes…"
            aria-label="Search the menu"
            className="min-h-11 rounded-full border-border bg-card pl-10"
          />
        </div>

        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-full bg-muted/60 p-1.5 [&::-webkit-scrollbar]:hidden">
            <TabsTrigger
              value="all"
              className="min-h-9 shrink-0 rounded-full px-4 text-sm data-[state=active]:bg-forest data-[state=active]:text-cream"
            >
              All
            </TabsTrigger>
            {(bootstrap?.categories ?? []).map((c) => (
              <TabsTrigger
                key={c.id}
                value={c.id}
                className="min-h-9 shrink-0 rounded-full px-4 text-sm data-[state=active]:bg-forest data-[state=active]:text-cream"
              >
                {c.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Reveal>

      {/* Count */}
      <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "dish" : "dishes"}
        {query.trim() ? ` matching “${query.trim()}”` : ""}
      </p>

      {/* Grid / empty state */}
      {filtered.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product, i) => (
            <Reveal key={product.id} delay={Math.min(i, 5) * 0.05}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
          <SearchX className="size-12 text-muted-foreground/50" aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl font-semibold">Nothing found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {query.trim()
                ? `No dishes match “${query.trim()}”. Try a different search.`
                : "No dishes in this category yet — check back soon."}
            </p>
          </div>
          {query.trim() && (
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
              className="min-h-11 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
            >
              Clear search
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
