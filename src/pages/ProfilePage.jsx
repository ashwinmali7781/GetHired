import { useState, useEffect, useMemo } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabase } from "@/hooks/use-supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getLevel } from "@/lib/xp";
import {
  Settings, Clock, Flame, TrendingUp, Code2,
  CheckCircle2, Trophy, Target, Calendar, Loader2,
  Pencil, X, Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ── helpers ── */
function fmt(s) { return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff/60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}
function calcStreak(history) {
  const days = new Set(history.map(h => new Date(h.created_at).toDateString()));
  let streak = 0, d = new Date();
  while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate()-1); }
  return streak;
}
function calcMaxStreak(history) {
  const days = [...new Set(history.map(h => new Date(h.created_at).toISOString().slice(0,10)))].sort();
  let max=0,cur=0,prev=null;
  for (const d of days) {
    cur = prev && (new Date(d)-new Date(prev))/86400000===1 ? cur+1 : 1;
    max=Math.max(max,cur); prev=d;
  }
  return max;
}

/* ── Heatmap ── */
function SubmissionHeatmap({ history }) {
  const [tip, setTip] = useState(null);
  const today = useMemo(() => { const d=new Date(); d.setHours(0,0,0,0); return d; }, []);
  const countMap = useMemo(() => {
    const m={};
    history.forEach(h => { const k=new Date(h.created_at).toISOString().slice(0,10); m[k]=(m[k]||0)+1; });
    return m;
  }, [history]);
  const weeks = useMemo(() => {
    const res=[], s=new Date(today);
    s.setDate(s.getDate()-52*7+1-s.getDay());
    let d=new Date(s);
    for(let w=0;w<53;w++) {
      const wk=[];
      for(let day=0;day<7;day++) {
        const k=d.toISOString().slice(0,10);
        wk.push({date:new Date(d),key:k,count:countMap[k]||0});
        d.setDate(d.getDate()+1);
      }
      res.push(wk);
    }
    return res;
  }, [countMap, today]);
  const monthLabels = useMemo(() => {
    const labs=[]; let last=-1;
    weeks.forEach((w,wi) => { const m=w[0].date.getMonth(); if(m!==last){labs.push({wi,label:w[0].date.toLocaleString("default",{month:"short"})}); last=m;} });
    return labs;
  },[weeks]);
  const sorted = Object.values(countMap).filter(v=>v>0).sort((a,b)=>a-b);
  const p25=sorted[Math.floor(sorted.length*.25)]||1, p50=sorted[Math.floor(sorted.length*.5)]||2, p75=sorted[Math.floor(sorted.length*.75)]||4;
  const getLevel = c => c===0?0:c<=p25?1:c<=p50?2:c<=p75?3:4;
  const COLORS = ["hsl(var(--muted))","hsl(var(--primary)/0.2)","hsl(var(--primary)/0.4)","hsl(var(--primary)/0.7)","hsl(var(--primary))"];
  const cs=12, gap=2, step=cs+gap;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm font-semibold text-foreground">{history.length} submissions this year</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Less</span>
          {COLORS.map((c,i)=><div key={i} style={{width:cs,height:cs,borderRadius:3,background:c,flexShrink:0}}/>)}
          <span>More</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-1">
          <div className="flex flex-col mr-1" style={{marginTop:18,gap}}>
            {["","Mon","","Wed","","Fri",""].map((l,i)=>(
              <div key={i} style={{height:cs,fontSize:9,lineHeight:`${cs}px`,color:"hsl(var(--muted-foreground))",textAlign:"right",paddingRight:4,width:24}}>{l}</div>
            ))}
          </div>
          <div>
            <div className="flex mb-1" style={{gap}}>
              {weeks.map((_,wi)=>{const lbl=monthLabels.find(m=>m.wi===wi); return <div key={wi} style={{width:cs,fontSize:9,color:"hsl(var(--muted-foreground))",overflow:"hidden",whiteSpace:"nowrap"}}>{lbl?lbl.label:""}</div>;})}
            </div>
            <div className="flex" style={{gap}}>
              {weeks.map((week,wi)=>(
                <div key={wi} className="flex flex-col" style={{gap}}>
                  {week.map((cell,di)=>{
                    const future=cell.date>today;
                    const bg=future?"transparent":COLORS[getLevel(cell.count)];
                    return (
                      <div key={`${wi}-${di}`}
                        style={{width:cs,height:cs,borderRadius:3,background:bg,cursor:future?"default":"pointer",flexShrink:0,transition:"transform 0.1s"}}
                        onMouseEnter={e=>{if(future)return;const r=e.currentTarget.getBoundingClientRect();setTip({visible:true,text:cell.count===0?`No submissions`:`${cell.count} submission${cell.count!==1?"s":""}`,date:cell.date.toLocaleDateString("en-US",{month:"short",day:"numeric"}),x:r.left+r.width/2,y:r.top-8});}}
                        onMouseLeave={()=>setTip(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {tip?.visible && (
        <div className="fixed z-50 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg pointer-events-none"
          style={{left:tip.x,top:tip.y,transform:"translate(-50%,-100%)"}}>
          <span className="font-semibold text-primary">{tip.text}</span>
          {" "}<span className="text-muted-foreground">{tip.date}</span>
        </div>
      )}
    </div>
  );
}

/* ── Donut ── */
function SolvedDonut({ easy, medium, hard, totalEasy=100, totalMedium=200, totalHard=100 }) {
  const total = easy+medium+hard;
  const maxTotal = totalEasy+totalMedium+totalHard;
  const r=52, cx=60, cy=60, sw=8, circ=2*Math.PI*r;
  const segs = [
    {val:easy,   color:"#10b981", label:"Easy",   tot:totalEasy},
    {val:medium, color:"#f59e0b", label:"Medium",  tot:totalMedium},
    {val:hard,   color:"#ef4444", label:"Hard",    tot:totalHard},
  ];
  let offset=0;
  const arcs = segs.map(s=>{const pct=maxTotal>0?s.val/maxTotal:0;const a={...s,pct,offset};offset+=pct;return a;});
  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{width:120,height:120}}>
        <svg width={120} height={120} style={{transform:"rotate(-90deg)"}}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={sw}/>
          {arcs.map((arc,i)=>(
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={arc.color}
              strokeWidth={sw} strokeDasharray={`${arc.pct*circ} ${circ}`}
              strokeDashoffset={-arc.offset*circ} strokeLinecap="round"/>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-none">{total}</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">Solved</span>
        </div>
      </div>
      <div className="space-y-2.5 flex-1">
        {segs.map(d=>(
          <div key={d.label} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold" style={{color:d.color}}>{d.label}</span>
              <span className="text-muted-foreground font-mono">{d.val}/{d.tot}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div className="h-full rounded-full" style={{background:d.color}}
                initial={{width:0}} animate={{width:`${d.tot>0?(d.val/d.tot)*100:0}%`}}
                transition={{duration:0.8,ease:"easeOut"}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Badge defs ── */
const BADGE_DEFS = [
  {id:"first_solve",   icon:"🎯",label:"First Solve",   req:s=>s.totalSolved>=1},
  {id:"ten_problems",  icon:"🔟",label:"10 Problems",   req:s=>s.totalSolved>=10},
  {id:"fifty",         icon:"🏅",label:"50 Problems",   req:s=>s.totalSolved>=50},
  {id:"century",       icon:"💯",label:"Century",       req:s=>s.totalSolved>=100},
  {id:"streak7",       icon:"🔥",label:"Week Warrior",  req:s=>s.maxStreak>=7},
  {id:"streak30",      icon:"⚡",label:"Monthly Grind", req:s=>s.maxStreak>=30},
  {id:"hard_solver",   icon:"💎",label:"Hard Mode",     req:s=>s.hardSolved>=1},
  {id:"all_easy",      icon:"✅",label:"Easy Peasy",    req:s=>s.easySolved>=10},
  {id:"speed_demon",   icon:"🚀",label:"Speed Demon",   req:s=>s.fastestSolve!==null},
];

function ProfileSkeleton() {
  return (
    <div className="flex gap-6 flex-col lg:flex-row animate-fade-in">
      <div className="w-full lg:w-64 space-y-4">
        <Skeleton className="h-52 rounded-2xl"/>
        <Skeleton className="h-28 rounded-2xl"/>
        <Skeleton className="h-32 rounded-2xl"/>
      </div>
      <div className="flex-1 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_,i)=><Skeleton key={i} className="h-20 rounded-2xl"/>)}
        </div>
        <Skeleton className="h-40 rounded-2xl"/>
        <Skeleton className="h-44 rounded-2xl"/>
        <Skeleton className="h-64 rounded-2xl"/>
      </div>
    </div>
  );
}

const ProfilePage = () => {
  const { user: clerkUser, isLoaded } = useUser();
  const { openUserProfile } = useClerk();
  const { user } = useAuth();
  const supabase = useSupabase();
  const { toast } = useToast();

  const [history, setHistory]     = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("recent");
  const [editOpen, setEditOpen]   = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [saving, setSaving]       = useState(false);
  const [bio,       setBio]       = useState("");
  const [location,  setLocation]  = useState("");
  const [profileXp,  setProfileXp]  = useState(0);

  useEffect(() => {
    if (isLoaded && clerkUser) { setFirstName(clerkUser.firstName||""); setLastName(clerkUser.lastName||""); }
  }, [isLoaded, clerkUser]);

  useEffect(() => {
    if (!user || !supabase) return;
    supabase.from("profiles").select("bio, location, total_xp").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) { setBio(data.bio||""); setLocation(data.location||""); setProfileXp(data.total_xp||0); } });
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("practice_history").select("*, questions(title,difficulty,category)").eq("user_id",user.id).order("created_at",{ascending:false}),
      supabase.from("questions").select("id, difficulty"),
    ]).then(([h,q]) => { setHistory(h.data||[]); setQuestions(q.data||[]); setLoading(false); });
  }, [user, supabase]);

  const handleSave = async () => {
    if (!clerkUser || !user) return;
    setSaving(true);
    try {
      await clerkUser.update({ firstName, lastName });
      const { error: dbError } = await supabase.from("profiles").upsert({
        user_id:      user.id,
        display_name: `${firstName} ${lastName}`.trim() || user.email,
        email:        user.email,
        bio:          bio.trim(),
        location:     location.trim(),
        updated_at:   new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (dbError) console.error("[profile save]", dbError.message);
      toast({ title: "Profile updated!" });
      setEditOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err?.errors?.[0]?.message || err?.message || "Could not update.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  /* derived stats */
  const totalEasy=questions.filter(q=>q.difficulty==="Easy").length||951;
  const totalMedium=questions.filter(q=>q.difficulty==="Medium").length||2074;
  const totalHard=questions.filter(q=>q.difficulty==="Hard").length||947;
  const correctHistory=history.filter(h=>h.is_correct);
  const solvedIds=new Set(correctHistory.map(h=>h.question_id));
  const solvedQs=questions.filter(q=>solvedIds.has(q.id));
  const easySolved=solvedQs.filter(q=>q.difficulty==="Easy").length;
  const mediumSolved=solvedQs.filter(q=>q.difficulty==="Medium").length;
  const hardSolved=solvedQs.filter(q=>q.difficulty==="Hard").length;
  const totalSolved=easySolved+mediumSolved+hardSolved;
  const streak=calcStreak(history);
  const maxStreak=calcMaxStreak(history);
  const fastestSolve=useMemo(()=>{
    const f=correctHistory.filter(h=>h.time_spent_seconds&&h.time_spent_seconds<300);
    return f.length?Math.min(...f.map(h=>h.time_spent_seconds)):null;
  },[correctHistory]);
  const earnedBadges=BADGE_DEFS.filter(b=>b.req({totalSolved,easySolved,hardSolved,maxStreak,fastestSolve}));
  const recentAC=useMemo(()=>{const seen=new Set();return correctHistory.filter(h=>{if(seen.has(h.question_id))return false;seen.add(h.question_id);return true;}).slice(0,10);},[correctHistory]);

  const displayName=clerkUser?.fullName||[firstName,lastName].filter(Boolean).join(" ")||clerkUser?.primaryEmailAddress?.emailAddress||"";
  const initials=displayName.slice(0,2).toUpperCase();
  const email=clerkUser?.primaryEmailAddress?.emailAddress||"";
  const memberSince=clerkUser?.createdAt?new Date(clerkUser.createdAt).toLocaleDateString(undefined,{month:"long",year:"numeric"}):"";

  if (!isLoaded || loading) return <ProfileSkeleton />;

  const stats = [
    {icon:CheckCircle2, label:"Solved",      value:totalSolved,                                                    color:"text-emerald-500", bg:"bg-emerald-500/10"},
    {icon:Flame,        label:"Streak",      value:`${streak}d`,                                                   color:"text-orange-400",  bg:"bg-orange-400/10"},
    {icon:TrendingUp,   label:"Submissions", value:history.length,                                                 color:"text-primary",      bg:"bg-primary/10"},
    {icon:Target,       label:"Accuracy",    value:`${history.length>0?Math.round((correctHistory.length/history.length)*100):0}%`, color:"text-blue-400", bg:"bg-blue-400/10"},
  ];

  return (
    <div className="pb-8">
      <div className="flex gap-6 flex-col lg:flex-row">

        {/* ── LEFT ── */}
        <motion.div className="w-full lg:w-64 shrink-0 space-y-4" initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{duration:0.35}}>
          {/* Avatar card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="relative group">
                <Avatar className="h-20 w-20 ring-4 ring-primary/10">
                  <AvatarImage src={clerkUser?.imageUrl}/>
                  <AvatarFallback className="gradient-primary text-2xl font-bold text-white">{initials}</AvatarFallback>
                </Avatar>
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">{displayName||"User"}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-xs gradient-primary text-white font-semibold gap-1.5"
                onClick={()=>setEditOpen(v=>!v)}>
                <Pencil className="h-3 w-3"/> Edit
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0"
                onClick={()=>openUserProfile()} title="Account settings">
                <Settings className="h-3.5 w-3.5"/>
              </Button>
            </div>

            <AnimatePresence>
              {editOpen && (
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}
                  className="overflow-hidden border-t border-border pt-3 space-y-2.5">
                  {[{label:"First Name",val:firstName,set:setFirstName},{label:"Last Name",val:lastName,set:setLastName}].map(f=>(
                    <div key={f.label} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{f.label}</Label>
                      <Input value={f.val} onChange={e=>f.set(e.target.value)} className="h-8 text-xs"/>
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Location</Label>
                    <Input value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. San Francisco, CA" className="h-8 text-xs"/>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Bio</Label>
                    <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="A short bio about yourself…"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs resize-none min-h-[60px] focus:outline-none focus:ring-1 focus:ring-ring"/>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs gradient-primary text-white" onClick={handleSave} disabled={saving}>
                      {saving?<Loader2 className="h-3 w-3 animate-spin"/>:<><Check className="h-3 w-3"/> Save</>}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={()=>setEditOpen(false)}>
                      <X className="h-3.5 w-3.5"/>

                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Meta */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
            {memberSince && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5 shrink-0"/><span>Joined {memberSince}</span></div>}
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Code2 className="h-3.5 w-3.5 shrink-0"/><span>{totalSolved} problems solved</span></div>
            {profileXp > 0 && (() => {
              const lvl = getLevel(profileXp);
              return (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-primary">Lv.{lvl.level} {lvl.title}</span>
                    <span className="text-muted-foreground">{profileXp} XP</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full gradient-primary transition-all duration-700" style={{width:`${lvl.progress}%`}}/>
                  </div>
                </div>
              );
            })()}
            {streak>0&&<div className="flex items-center gap-2 text-xs text-orange-400"><Flame className="h-3.5 w-3.5 shrink-0"/><span>{streak}-day streak</span></div>}
            {maxStreak>0&&<div className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5 shrink-0"/><span>Best streak: {maxStreak} days</span></div>}
          </div>

          {/* Badges sidebar */}
          {earnedBadges.length>0&&(
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Badges</h3>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{earnedBadges.length}</Badge>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {earnedBadges.map(b=>(
                  <div key={b.id} title={b.label}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 text-lg border border-border hover:border-primary/40 transition-colors cursor-default">
                    {b.icon}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── RIGHT ── */}
        <motion.div className="flex-1 min-w-0 space-y-5" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.4,delay:0.1}}>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s,i)=>(
              <motion.div key={s.label} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}>
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 card-hover">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                    <s.icon className={`h-4.5 w-4.5 ${s.color}`}/>
                  </div>
                  <div>
                    <p className="text-xl font-bold leading-none">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Donut + Badges grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Problems Solved</h3>
              <SolvedDonut easy={easySolved} medium={mediumSolved} hard={hardSolved}
                totalEasy={totalEasy} totalMedium={totalMedium} totalHard={totalHard}/>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Achievements</h3>
              {earnedBadges.length===0?(
                <div className="flex flex-col items-center justify-center h-24 text-center gap-2">
                  <Trophy className="h-8 w-8 text-muted-foreground/20"/>
                  <p className="text-xs text-muted-foreground">Solve problems to earn badges!</p>
                </div>
              ):(
                <div className="grid grid-cols-3 gap-2">
                  {earnedBadges.slice(0,9).map(b=>(
                    <div key={b.id} title={b.label}
                      className="flex flex-col items-center gap-1 rounded-xl border border-border bg-muted/30 p-2.5 text-center hover:border-primary/40 transition-colors cursor-default">
                      <span className="text-xl">{b.icon}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight">{b.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Heatmap */}
          <SubmissionHeatmap history={history}/>

          {/* Recent AC / All tabs */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex border-b border-border px-4">
              {[{id:"recent",label:"Recent AC"},{id:"all",label:"All Submissions"}].map(t=>(
                <button key={t.id} onClick={()=>setActiveTab(t.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                    activeTab===t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>{t.label}
                </button>
              ))}
            </div>
            <div className="divide-y divide-border/50">
              {(activeTab==="recent"?recentAC:history.slice(0,20)).length===0?(
                <div className="py-12 text-center text-sm text-muted-foreground">No submissions yet</div>
              ):(activeTab==="recent"?recentAC:history.slice(0,20)).map((h,i)=>(
                <motion.div key={h.id||i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.02}}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {h.is_correct
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0"/>
                      : <div className="h-4 w-4 rounded-full border-2 border-red-400/60 shrink-0"/>}
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${h.is_correct?"text-foreground":"text-muted-foreground"}`}>
                        {h.questions?.title||"Unknown Problem"}
                      </p>
                      <p className={`text-[10px] font-medium ${
                        h.is_correct?"text-emerald-500":"text-red-400"
                      }`}>{h.is_correct?"Accepted":"Wrong Answer"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {h.time_spent_seconds!=null&&(
                      <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                        <Clock className="h-3 w-3 inline mr-1"/>{fmt(h.time_spent_seconds)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{timeAgo(h.created_at)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;
