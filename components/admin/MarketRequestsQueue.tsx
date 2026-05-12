"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type RequestStatus = "pending" | "approved" | "rejected";

type MarketRequest = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: RequestStatus;
  created_at: string;
  user_id: string;
  profiles: { username: string | null } | null;
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_ICONS: Record<RequestStatus, React.ReactNode> = {
  pending: <Clock className="size-3" />,
  approved: <CheckCircle className="size-3" />,
  rejected: <XCircle className="size-3" />,
};

export function MarketRequestsQueue({
  onApprove,
}: {
  onApprove: (title: string, category: string, description: string) => void;
}) {
  const [requests, setRequests] = useState<MarketRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RequestStatus | "all">("pending");

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("market_requests")
      .select("id, title, description, category, status, created_at, user_id, profiles(username)")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRequests((data ?? []) as unknown as MarketRequest[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: RequestStatus) {
    const supabase = createClient();
    const { error } = await supabase
      .from("market_requests")
      .update({ status })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    toast.success(status === "approved" ? "Approved" : "Rejected");
  }

  function handleApprove(req: MarketRequest) {
    updateStatus(req.id, "approved");
    onApprove(req.title, req.category, req.description ?? "");
  }

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (loading) {
    return <p className="text-sm text-gray-400 py-6 text-center">Loading requests…</p>;
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all capitalize ${
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {f}
            {f === "pending" && pendingCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                filter === "pending" ? "bg-white text-gray-900" : "bg-yellow-400 text-white"
              }`}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 py-12 text-center">
          <p className="text-sm text-gray-400">
            {filter === "pending" ? "No pending requests — all caught up!" : `No ${filter} requests.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <div
              key={req.id}
              className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{req.title}</p>
                  {req.description && (
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed line-clamp-2">
                      {req.description}
                    </p>
                  )}
                </div>
                {/* Status badge */}
                <span className={`shrink-0 flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[req.status]}`}>
                  {STATUS_ICONS[req.status]}
                  {req.status}
                </span>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <User className="size-3" />
                  {req.profiles?.username ?? "unknown"}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">
                  {req.category}
                </span>
                <span>{new Date(req.created_at).toLocaleDateString()}</span>
              </div>

              {/* Actions — only for pending */}
              {req.status === "pending" && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleApprove(req)}
                    className="flex items-center gap-1.5 rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-green-600 active:scale-95"
                  >
                    <CheckCircle className="size-4" />
                    Approve &amp; create
                  </button>
                  <button
                    onClick={() => updateStatus(req.id, "rejected")}
                    className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition-all hover:bg-red-50 active:scale-95"
                  >
                    <XCircle className="size-4" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
