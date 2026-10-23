"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store/app-store";
import { Eyebrow, Reveal } from "./storefront-lib";
import { ProductCard } from "./product-card";

export function MenuView() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const params = useAppStore((s) => s.params);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(params.category ?? "all");

  const products = useMemo(() => (bootstrap?.products ?? []).filter((p) => !p.archived), [bootstrap]);

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
          Everything is cooked fresh to order. Pick a dish, customise your plate, and we&apos;ll get started.
        </p>
      </Reveal>

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
