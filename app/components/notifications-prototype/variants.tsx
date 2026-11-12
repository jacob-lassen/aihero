// PROTOTYPE — throwaway. Lives on branch prototype/notifications-ui only.
// Question (wayfinder ticket "How Notifications look in the app"): how do
// Notifications look and behave in Cadence? Four structurally different answers,
// switchable via ?variant=A|B|C|D on any app page, mounted in the app layout.
//   A  Bell popover      — bell beside the logo, dropdown of latest, "See all" page. No count (v1 has no read state).
//   B  Inbox page        — a sidebar nav item to a full /notifications page. No bell, no dropdown.
//   C  Digest drawer     — sidebar item opens a right-hand drawer; Notifications grouped by kind + course.
//   D  With read state   — what v1 is NOT building: unread badge, mark-read, toasts. For the read-state fog.
import { Link, NavLink, useSearchParams, useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Inbox,
  MessageSquare,
  Receipt,
  Star,
  UsersRound,
  BookPlus,
  X,
  CheckCheck,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type {
  PrototypeNotification,
  PrototypeNotificationKind,
} from "./fixtures.server";

export const VARIANTS = [
  { key: "A", name: "Bell popover" },
  { key: "B", name: "Inbox page" },
  { key: "C", name: "Digest drawer" },
  { key: "D", name: "With read state (beyond v1)" },
] as const;
export type VariantKey = (typeof VARIANTS)[number]["key"];

const STORAGE_KEY = "prototype-notifications";

// ?variant= and ?feed=empty stick across navigation (clicking a Notification
// leaves the page), so mirror them in sessionStorage.
export function usePrototypeState() {
  const [params] = useSearchParams();
  const [stored, setStored] = useState<{ variant: VariantKey; empty: boolean }>({ variant: "A", empty: false });
  useEffect(() => {
    let s = stored;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) s = JSON.parse(raw);
    } catch {}
    const v = params.get("variant")?.toUpperCase();
    if (v && VARIANTS.some((x) => x.key === v)) s = { ...s, variant: v as VariantKey };
    if (params.has("feed")) s = { ...s, empty: params.get("feed") === "empty" };
    setStored(s);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  return stored;
}

// ---------- shared bits (icons, time, row) ----------

const KIND: Record<PrototypeNotificationKind, { icon: React.ReactNode; label: string }> = {
  "refund-requested": { icon: <Receipt className="size-4" />, label: "Refund Requests" },
  "refund-decided": { icon: <Receipt className="size-4" />, label: "Refund decisions" },
  "refund-issued": { icon: <Receipt className="size-4" />, label: "Refunds issued" },
  "seat-claimed": { icon: <UsersRound className="size-4" />, label: "Seats claimed" },
  "new-enrollment": { icon: <GraduationCap className="size-4" />, label: "New Enrollments" },
  "new-comment": { icon: <MessageSquare className="size-4" />, label: "Discussion Questions" },
  "new-reply": { icon: <MessageSquare className="size-4" />, label: "Discussion Replies" },
  "new-rating": { icon: <Star className="size-4" />, label: "Ratings" },
  "new-lessons": { icon: <BookPlus className="size-4" />, label: "New lessons" },
};

function ago(iso: string) {
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d` : `${Math.round(d / 7)}w`;
}

function dayBucket(iso: string) {
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 24) return "Today";
  if (h < 48) return "Yesterday";
  if (h < 24 * 7) return "This week";
  return "Earlier";
}

function Row({ n, compact, unread, onOpen }: { n: PrototypeNotification; compact?: boolean; unread?: boolean; onOpen?: () => void }) {
  return (
    <Link
      to={n.url}
      onClick={onOpen}
      className={cn(
        "flex gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted",
        unread && "bg-primary/5"
      )}
    >
      <div className="mt-0.5 shrink-0 text-muted-foreground">{KIND[n.kind].icon}</div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>{n.title}</div>
        <div className={cn("text-xs text-muted-foreground", compact && "truncate")}>{n.body}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground">{ago(n.createdAt)}</span>
        {unread && <span className="size-2 rounded-full bg-primary" />}
      </div>
    </Link>
  );
}

function Empty({ small }: { small?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 text-center text-muted-foreground", small ? "py-10" : "py-24")}>
      <BellOff className={small ? "size-6" : "size-10"} />
      <div className="text-sm font-medium text-foreground">No Notifications yet</div>
      <div className="max-w-60 text-xs">
        When something needs your attention, like a reply to your question or a decision on a Refund Request, it shows up here.
      </div>
    </div>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOut]);
}

// ---------- A: bell popover, no count ----------

export function VariantABell({ items }: { items: PrototypeNotification[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-4" />
      </button>
      {open && (
        <div className="absolute left-full top-0 z-50 ml-3 w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm font-semibold">Notifications</div>
            <span className="text-xs text-muted-foreground">Latest {Math.min(8, items.length)}</span>
          </div>
          <div className="max-h-[28rem] overflow-y-auto p-1">
            {items.length === 0 ? <Empty small /> : items.slice(0, 8).map((n) => <Row key={n.id} n={n} compact onOpen={() => setOpen(false)} />)}
          </div>
          {items.length > 0 && (
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block border-t px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted"
            >
              See all {items.length} Notifications
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- B: nav item to a full page ----------

export function VariantBNavItem() {
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Inbox className="size-4" />
      Notifications
    </NavLink>
  );
}

// The /notifications page (used by A's "See all" and by B).
export function NotificationsPage({ items, variant }: { items: PrototypeNotification[]; variant: VariantKey }) {
  const kinds = useMemo(() => Array.from(new Set(items.map((n) => n.kind))), [items]);
  const [filter, setFilter] = useState<PrototypeNotificationKind | "all">("all");
  const shown = filter === "all" ? items : items.filter((n) => n.kind === filter);
  const groups = useMemo(() => {
    const m = new Map<string, PrototypeNotification[]>();
    for (const n of shown) {
      const k = dayBucket(n.createdAt);
      m.set(k, [...(m.get(k) ?? []), n]);
    }
    return Array.from(m);
  }, [shown]);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything sent to you, newest first.
        {(variant === "C" || variant === "D") && " (This variant doesn't link here — shown for comparison.)"}
      </p>
      {kinds.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {(["all", ...kinds] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                filter === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {k === "all" ? `All (${items.length})` : `${KIND[k].label} (${items.filter((n) => n.kind === k).length})`}
            </button>
          ))}
        </div>
      )}
      {items.length === 0 ? (
        <Empty />
      ) : (
        groups.map(([label, list]) => (
          <section key={label} className="mt-6">
            <h2 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h2>
            <div className="divide-y rounded-lg border">
              {list.map((n) => (
                <Row key={n.id} n={n} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

// ---------- C: digest drawer ----------

export function VariantCDrawer({ items }: { items: PrototypeNotification[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const digests = useMemo(() => {
    const m = new Map<string, PrototypeNotification[]>();
    for (const n of items) {
      const k = `${n.kind}|${n.subject}`;
      m.set(k, [...(m.get(k) ?? []), n]);
    }
    return Array.from(m.values()); // items are newest-first, so digests are ordered by latest member
  }, [items]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-4" />
        Notifications
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-[26rem] flex-col border-l bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <div className="font-semibold">Notifications</div>
                <div className="text-xs text-muted-foreground">{items.length} Notifications in {digests.length} groups</div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {items.length === 0 ? (
                <Empty small />
              ) : (
                digests.map((list) => {
                  const first = list[0];
                  const key = `${first.kind}|${first.subject}`;
                  if (list.length === 1) return <Row key={key} n={first} onOpen={() => setOpen(false)} />;
                  const isOpen = expanded === key;
                  return (
                    <div key={key} className="rounded-md">
                      <button
                        onClick={() => setExpanded(isOpen ? null : key)}
                        className="flex w-full gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted"
                      >
                        <div className="mt-0.5 shrink-0 text-muted-foreground">{KIND[first.kind].icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">
                            {list.length} {KIND[first.kind].label.toLowerCase()} · {first.subject}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            Latest: {first.body}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-start gap-1 text-xs text-muted-foreground">
                          {ago(first.createdAt)}
                          <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                        </div>
                      </button>
                      {isOpen && (
                        <div className="ml-7 border-l pl-2">
                          {list.map((n) => (
                            <Row key={n.id} n={n} compact onOpen={() => setOpen(false)} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ---------- D: bell with unread count, mark-read, toasts (beyond v1) ----------

export function VariantDBell({ items: initial }: { items: PrototypeNotification[] }) {
  const [items, setItems] = useState(initial);
  useEffect(() => setItems(initial), [initial]);
  // pretend everything older than 2 days was already read
  const [read, setRead] = useState<Set<string>>(
    () => new Set(initial.filter((n) => Date.now() - new Date(n.createdAt).getTime() > 48 * 36e5).map((n) => n.id))
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const navigate = useNavigate();
  const unread = items.filter((n) => !read.has(n.id)).length;

  function simulateArrival() {
    const template = initial[Math.floor(Math.random() * initial.length)];
    if (!template) return;
    const n = { ...template, id: `sim${Date.now()}`, createdAt: new Date().toISOString() };
    setItems((xs) => [n, ...xs]);
    toast(n.title, {
      description: n.body,
      action: { label: "Open", onClick: () => { setRead((r) => new Set(r).add(n.id)); navigate(n.url); } },
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-full top-0 z-50 ml-3 w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm font-semibold">Notifications {unread > 0 && <span className="text-muted-foreground">· {unread} unread</span>}</div>
            <button
              disabled={unread === 0}
              onClick={() => setRead(new Set(items.map((n) => n.id)))}
              className="flex items-center gap-1 text-xs font-medium text-primary disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-[28rem] overflow-y-auto p-1">
            {items.length === 0 ? (
              <Empty small />
            ) : (
              items.slice(0, 15).map((n) => (
                <Row
                  key={n.id}
                  n={n}
                  compact
                  unread={!read.has(n.id)}
                  onOpen={() => {
                    setRead((r) => new Set(r).add(n.id));
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs">
            <span className="text-muted-foreground">Read state lives in memory only (prototype).</span>
            <button onClick={simulateArrival} className="font-medium text-primary">Simulate arrival → toast</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- floating switcher ----------

export function PrototypeSwitcher({ current, empty }: { current: VariantKey; empty: boolean }) {
  const [params, setParams] = useSearchParams();
  const idx = VARIANTS.findIndex((v) => v.key === current);
  function go(delta: number) {
    const next = VARIANTS[(idx + delta + VARIANTS.length) % VARIANTS.length].key;
    const p = new URLSearchParams(params);
    p.set("variant", next);
    setParams(p, { replace: true, preventScrollReset: true });
  }
  function toggleEmpty() {
    const p = new URLSearchParams(params);
    p.set("feed", empty ? "full" : "empty");
    setParams(p, { replace: true, preventScrollReset: true });
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable], .monaco-editor")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (import.meta.env.PROD) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-black px-2 py-1.5 text-sm text-white shadow-2xl ring-2 ring-fuchsia-500">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/20"><ChevronLeft className="size-4" /></button>
      <span className="px-2 font-medium">
        {current} <span className="text-white/60">({VARIANTS[idx]?.name})</span>
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/20"><ChevronRight className="size-4" /></button>
      <span className="mx-1 h-4 w-px bg-white/30" />
      <button onClick={toggleEmpty} className="rounded-full px-2 py-0.5 text-xs hover:bg-white/20">
        {empty ? "Empty feed ✓" : "Empty feed"}
      </button>
    </div>
  );
}
