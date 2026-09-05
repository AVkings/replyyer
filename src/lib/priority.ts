export const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITY_ORDER)[number];

export const priorityWeight: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortByPriority<T extends { priority?: string | null; created_at?: string }>(a: T, b: T) {
  const wa = priorityWeight[a.priority || ""] ?? 4;
  const wb = priorityWeight[b.priority || ""] ?? 4;
  if (wa !== wb) return wa - wb;
  return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
}

export function priorityStyle(p?: string | null) {
  switch (p) {
    case "urgent":
      return "bg-black text-white";
    case "high":
      return "bg-zinc-800 text-white";
    case "medium":
      return "bg-zinc-200 text-zinc-800";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}
