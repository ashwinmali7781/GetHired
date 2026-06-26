import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabase } from "@/hooks/use-supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, MessageSquare, Send, Loader2, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

function CommentCard({ post, currentUserId, onVote, onReply, onDelete, depth = 0 }) {
  const [showReplies, setShowReplies] = useState(true);
  const isOwn = post.user_id === currentUserId;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`${depth > 0 ? "ml-6 border-l-2 border-border/40 pl-3" : ""}`}>
      <div className="rounded-xl bg-muted/20 border border-border/40 p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                {(post.display_name || "A").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-semibold text-foreground">{post.display_name || "Anonymous"}</span>
            {isOwn && <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">You</Badge>}
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </span>
          </div>
          {isOwn && (
            <button onClick={() => onDelete(post.id)} className="text-muted-foreground/40 hover:text-red-400 transition-colors">
              <Trash2 className="h-3 w-3"/>
            </button>
          )}
        </div>
        {/* Content */}
        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {/* Actions */}
        <div className="flex items-center gap-3">
          <button onClick={() => onVote(post.id)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
            <ThumbsUp className="h-3 w-3"/> {post.upvotes || 0}
          </button>
          {depth === 0 && (
            <button onClick={() => onReply(post.id)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
              <MessageSquare className="h-3 w-3"/> Reply
            </button>
          )}
          {post.replies?.length > 0 && (
            <button onClick={() => setShowReplies(v => !v)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-auto">
              {showReplies ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>}
              {post.replies.length} {post.replies.length === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      </div>
      {/* Nested replies */}
      {showReplies && post.replies?.length > 0 && (
        <div className="mt-2 space-y-2">
          {post.replies.map(r => (
            <CommentCard key={r.id} post={r} currentUserId={currentUserId}
              onVote={onVote} onReply={onReply} onDelete={onDelete} depth={depth + 1}/>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function DiscussionPanel({ questionId }) {
  const { user }   = useAuth();
  const supabase   = useSupabase();
  const [posts, setPosts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [text, setText]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo]       = useState(null); // parent_id
  const [sortBy, setSortBy]         = useState("new"); // "new" | "top"
  const [votedIds, setVotedIds]     = useState(new Set());

  const load = useCallback(async () => {
    if (!questionId) return;
    setLoading(true);
    const { data } = await supabase
      .from("discussions")
      .select("*")
      .eq("question_id", questionId)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // Build tree
    const map = {};
    data.forEach(p => { map[p.id] = { ...p, replies: [] }; });
    const roots = [];
    data.forEach(p => {
      if (p.parent_id && map[p.parent_id]) map[p.parent_id].replies.push(map[p.id]);
      else roots.push(map[p.id]);
    });

    const sorted = sortBy === "top"
      ? roots.sort((a, b) => b.upvotes - a.upvotes)
      : roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setPosts(sorted);
    setLoading(false);
  }, [questionId, supabase, sortBy]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!user || !text.trim() || submitting) return;
    setSubmitting(true);
    const { data: profile } = await supabase
      .from("profiles").select("display_name").eq("user_id", user.id).single();

    await supabase.from("discussions").insert({
      question_id:  questionId,
      user_id:      user.id,
      display_name: profile?.display_name || user.email?.split("@")[0] || "Anonymous",
      content:      text.trim(),
      parent_id:    replyTo || null,
    });

    setText(""); setReplyTo(null); setSubmitting(false);
    load();
  };

  const handleVote = async (postId) => {
    if (!user) return;
    if (votedIds.has(postId)) return; // already voted
    // Try insert vote
    const { error } = await supabase.from("discussion_votes")
      .insert({ user_id: user.id, discussion_id: postId });
    if (error) return; // duplicate key = already voted
    // Increment upvote count
    await supabase.rpc("increment_discussion_upvotes", { discussion_id: postId })
      .catch(() => {
        // fallback if RPC not set up — update manually
        const post = posts.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(r => r.id === postId);
        if (post) supabase.from("discussions").update({ upvotes: (post.upvotes || 0) + 1 }).eq("id", postId);
      });
    setVotedIds(prev => new Set([...prev, postId]));
    setPosts(prev => prev.map(p => ({
      ...p,
      upvotes: p.id === postId ? (p.upvotes || 0) + 1 : p.upvotes,
      replies: (p.replies || []).map(r => r.id === postId ? { ...r, upvotes: (r.upvotes || 0) + 1 } : r),
    })));
  };

  const handleDelete = async (postId) => {
    if (!user) return;
    await supabase.from("discussions").delete().eq("id", postId).eq("user_id", user.id);
    load();
  };

  const replyTarget = replyTo ? posts.find(p => p.id === replyTo) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Sort controls */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/40">
        <p className="text-xs font-semibold text-muted-foreground">{posts.length} discussion{posts.length !== 1 ? "s" : ""}</p>
        <div className="flex gap-1">
          {["new", "top"].map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors capitalize ${
                sortBy === s ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <MessageSquare className="h-8 w-8 text-muted-foreground/20"/>
            <p className="text-xs text-muted-foreground">No discussions yet — be the first!</p>
          </div>
        )}
        <AnimatePresence>
          {posts.map(post => (
            <CommentCard key={post.id} post={post} currentUserId={user?.id}
              onVote={handleVote} onReply={setReplyTo} onDelete={handleDelete}/>
          ))}
        </AnimatePresence>
      </div>

      {/* Compose */}
      <div className="border-t border-border/40 p-3 space-y-2">
        {replyTarget && (
          <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-2.5 py-1.5">
            <p className="text-[10px] text-primary">Replying to {replyTarget.display_name || "Anonymous"}</p>
            <button onClick={() => setReplyTo(null)} className="text-primary/60 hover:text-primary text-[10px]">✕ Cancel</button>
          </div>
        )}
        {!user ? (
          <p className="text-xs text-muted-foreground text-center py-2">Sign in to join the discussion.</p>
        ) : (
          <div className="flex gap-2 items-end">
            <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Share your approach or ask a question…"
              className="min-h-[60px] max-h-[120px] resize-none text-xs flex-1"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              disabled={submitting}/>
            <Button size="icon" onClick={handleSubmit} disabled={!text.trim() || submitting}
              className="h-9 w-9 gradient-primary text-white rounded-xl shrink-0 self-end">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Send className="h-3.5 w-3.5"/>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
