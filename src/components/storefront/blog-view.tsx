"use client";

/**
 * Food Journal (blog) — listing + single-post detail (spec §18).
 * GET /api/blog returns published posts; the detail view finds one by slug.
 */

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays, Newspaper, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/app-store";
import { apiGet } from "@/lib/client";
import { Eyebrow, Reveal, SafeImage } from "./storefront-lib";

/** Shape returned by GET /api/blog (content/author are optional at runtime). */
interface BlogListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  altText: string;
  tags: string[];
  publishedAt: string | null;
  content?: string;
  author?: string;
}

function BlogSkeleton() {
  return (
    <div aria-busy="true" className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <Skeleton className="aspect-[16/10] w-full rounded-xl" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function PostCard({ post }: { post: BlogListItem }) {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <button
      type="button"
      onClick={() => navigate("blog", { post: post.slug })}
      aria-label={`Read more: ${post.title}`}
      className="group block h-full w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="flex h-full flex-col overflow-hidden rounded-2xl border-border shadow-sm transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          <SafeImage
            src={post.coverImage || undefined}
            alt={post.altText || post.title}
            className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
        <CardContent className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {post.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full text-[11px]">
                {tag}
              </Badge>
            ))}
          </div>
          <h2 className="font-display text-lg font-semibold leading-snug">{post.title}</h2>
          <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            {post.publishedAt && (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {format(new Date(post.publishedAt), "d MMM yyyy")}
              </p>
            )}
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-forest">
              Read more
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function BlogListView() {
  const [posts, setPosts] = useState<BlogListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ posts?: BlogListItem[] }>("/api/blog");
        if (!cancelled) setPosts(res.posts ?? []);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:py-14">
      <Reveal>
        <Eyebrow>Food Journal</Eyebrow>
        <h1 className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">Stories from our kitchen</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Recipes, kitchen notes and the little stories behind the plates — written by the people who cook them.
        </p>
      </Reveal>

      {posts === null && !failed && <BlogSkeleton />}

      {failed && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <Newspaper className="size-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the journal right now — please try again shortly.</p>
        </div>
      )}

      {posts !== null && posts.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <Newspaper className="size-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            No stories published yet — the kitchen is busy cooking. Check back soon.
          </p>
        </div>
      )}

      {posts !== null && posts.length > 0 && (
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <Reveal key={post.id} delay={Math.min(i, 5) * 0.05}>
              <PostCard post={post} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

function BlogDetailView({ slug }: { slug: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const [post, setPost] = useState<BlogListItem | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ posts?: BlogListItem[] }>("/api/blog");
        if (cancelled) return;
        const found = (res.posts ?? []).find((p) => p.slug === slug) ?? null;
        setPost(found);
      } catch {
        if (!cancelled) setPost(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const back = (
    <Button
      variant="ghost"
      onClick={() => navigate("blog")}
      className="min-h-11 gap-1.5 rounded-full text-forest hover:bg-forest/10"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      All stories
    </Button>
  );

  if (post === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:py-14" aria-busy="true">
        {back}
        <Skeleton className="mt-6 h-10 w-3/4" />
        <Skeleton className="mt-3 h-4 w-48" />
        <Skeleton className="mt-8 aspect-[16/9] w-full rounded-2xl" />
        <div className="mt-6 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (post === null) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 md:py-14">
        {back}
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <Newspaper className="size-10 text-muted-foreground/50" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold text-forest">We couldn&apos;t find that story</h1>
          <p className="text-sm text-muted-foreground">
            It may have been unpublished or the link is off by a letter. Browse the journal instead — there&apos;s
            always something simmering.
          </p>
          <Button
            onClick={() => navigate("blog")}
            className="mt-1 min-h-11 rounded-full bg-forest px-6 text-cream hover:bg-forest/90"
          >
            Back to the Food Journal
          </Button>
        </div>
      </div>
    );
  }

  const paragraphs = (post.content && post.content.trim().length > 0
    ? post.content
    : post.excerpt
  )
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 md:py-14">
      {back}
      <div className="mt-6">
        <Eyebrow>Food Journal</Eyebrow>
        <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight text-forest sm:text-4xl">{post.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {post.author && (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-4 text-gold" aria-hidden="true" />
              {post.author}
            </span>
          )}
          {post.publishedAt && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4 text-gold" aria-hidden="true" />
              {format(new Date(post.publishedAt), "d MMMM yyyy")}
            </span>
          )}
          {post.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="rounded-full text-[11px]">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {post.coverImage && (
        <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted shadow-md">
          <SafeImage
            src={post.coverImage}
            alt={post.altText || post.title}
            className="h-full w-full"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>
      )}

      <div className="mt-8 space-y-5">
        {paragraphs.map((paragraph, i) => (
          <p
            key={i}
            className={
              i === 0 && !post.content
                ? "text-base font-medium leading-relaxed text-foreground"
                : "text-base leading-relaxed text-foreground/90"
            }
          >
            {paragraph}
          </p>
        ))}
        {!post.content && (
          <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm italic leading-relaxed text-forest">
            This is the short version of the story — WhatsApp us on 0559291195 and we&apos;ll happily tell you the rest
            over the counter.
          </p>
        )}
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={() => navigate("menu")}
          className="min-h-11 flex-1 rounded-full bg-forest font-semibold text-cream hover:bg-forest/90"
        >
          Taste it for yourself — see the menu
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("blog")}
          className="min-h-11 flex-1 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
        >
          More from the journal
        </Button>
      </div>
    </article>
  );
}

export function BlogView() {
  const params = useAppStore((s) => s.params);
  const slug = params.post ?? "";
  return slug ? <BlogDetailView slug={slug} /> : <BlogListView />;
}
