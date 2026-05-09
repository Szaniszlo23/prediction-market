"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Send } from "lucide-react";

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string | null } | null;
};

type CommentsSectionProps = {
  marketId: string;
  currentUserId: string | null;
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function CommentsSection({ marketId, currentUserId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function fetchComments() {
    const supabase = createClient();
    const { data } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, profiles(username)")
      .eq("market_id", marketId)
      .order("created_at", { ascending: true })
      .limit(100);
    setComments((data ?? []) as unknown as Comment[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchComments();

    // Realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel(`comments:${marketId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `market_id=eq.${marketId}` },
        () => fetchComments(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!currentUserId) { toast.error("Log in to comment"); return; }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("comments").insert({
      market_id: marketId,
      user_id: currentUserId,
      content: trimmed,
    });
    setSubmitting(false);

    if (error) { toast.error(error.message); return; }
    setText("");
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Comments {comments.length > 0 && `· ${comments.length}`}
      </p>

      {/* Comment list */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <p className="py-4 text-center text-sm text-gray-400">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No comments yet. Be the first!</p>
        ) : (
          comments.map((c) => {
            const isOwn = c.user_id === currentUserId;
            const username = c.profiles?.username ?? "anonymous";
            return (
              <div key={c.id} className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isOwn ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
                }`}>
                  {username.charAt(0).toUpperCase()}
                </div>
                {/* Bubble */}
                <div className={`max-w-[75%] space-y-0.5 ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isOwn
                      ? "rounded-tr-sm bg-gray-900 text-white"
                      : "rounded-tl-sm bg-gray-100 text-gray-800"
                  }`}>
                    {c.content}
                  </div>
                  <p className="px-1 text-xs text-gray-400">
                    {isOwn ? "you" : username} · {timeAgo(c.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-gray-50 pt-4">
        {currentUserId ? (
          <>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment…"
              maxLength={500}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white transition-all hover:bg-gray-700 disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-400">
            <a href="/login" className="font-medium text-gray-700 underline underline-offset-2">Log in</a>
            {" "}to join the discussion.
          </p>
        )}
      </form>
    </div>
  );
}
