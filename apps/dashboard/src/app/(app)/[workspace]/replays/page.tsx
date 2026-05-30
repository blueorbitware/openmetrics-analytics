"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Video, Play, Pause, SkipBack, SkipForward, Maximize2, Volume2, VolumeX,
  Clock, MousePointer, AlertCircle, Globe, Smartphone, Monitor, Tablet,
  Search, Filter, Calendar, ChevronRight, Eye, X, User, MapPin, Chrome,
  Loader2, Settings2, RefreshCw, Zap, Shield, Code, Copy, Check, ArrowRight,
  BookOpen, CheckCircle2, Info
} from "lucide-react";
import { api, WorkspaceSettings } from "@/lib/api";

interface SessionReplay {
  id: string;
  session_id: string;
  user_id?: string;
  anon_id: string;
  entry_url: string;
  duration_ms: number;
  page_count: number;
  click_count: number;
  error_count: number;
  device_type: string;
  browser: string;
  country: string;
  city: string;
  started_at: string;
}

// No mock data - replays will be fetched from API when available
const MOCK_REPLAYS: SessionReplay[] = [];

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function DeviceIcon({ type }: { type: string }) {
  switch (type) {
    case "mobile":
      return <Smartphone className="w-4 h-4" />;
    case "tablet":
      return <Tablet className="w-4 h-4" />;
    default:
      return <Monitor className="w-4 h-4" />;
  }
}

function ReplayPlayer({ replay, onClose }: { replay: SessionReplay; onClose: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (playing) {
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            setPlaying(false);
            return 100;
          }
          return p + (speed * 0.5);
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [playing, speed]);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </Button>
          <div>
            <h3 className="font-semibold text-white">{replay.entry_url}</h3>
            <p className="text-sm text-white/60">
              {formatDate(replay.started_at)} at {formatTime(replay.started_at)} • {replay.browser} • {replay.city}, {replay.country}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={speed} 
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="bg-white/10 text-white border-0 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-5xl aspect-video bg-white rounded-xl shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="text-center">
              <Video className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Session Replay Player</p>
              <p className="text-sm text-slate-400 mt-2">
                DOM reconstruction and user interactions would render here
              </p>
            </div>
          </div>
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur">
            <MousePointer className="w-4 h-4" />
            <span>{replay.click_count} clicks</span>
          </div>
          {replay.error_count > 0 && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/80 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur">
              <AlertCircle className="w-4 h-4" />
              <span>{replay.error_count} errors</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setProgress(Math.max(0, progress - 10))}>
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10 w-12 h-12"
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setProgress(Math.min(100, progress + 10))}>
              <SkipForward className="w-5 h-5" />
            </Button>

            <div className="flex-1 mx-4">
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-rose-500 transition-all" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>

            <span className="text-white/60 text-sm min-w-[100px] text-right">
              {formatDuration((progress / 100) * replay.duration_ms)} / {formatDuration(replay.duration_ms)}
            </span>

            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setMuted(!muted)}>
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <Maximize2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupGuide({ onGoToSettings }: { onGoToSettings: () => void }) {
  const [copied, setCopied] = useState(false);
  
  const replayCode = `// Enable Session Replay in your tracking setup
analytics.enableReplay({
  sampleRate: 0.1,    // Record 10% of sessions
  maskInputs: true,   // Mask sensitive inputs
  maskText: false,    // Keep text visible
  recordCanvas: true  // Record canvas elements
});`;

  const copyCode = () => {
    navigator.clipboard.writeText(replayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 text-white overflow-hidden">
        <CardContent className="p-8 relative">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Video className="w-12 h-12" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">Enable Session Replay</h2>
              <p className="text-rose-100 max-w-xl">
                Watch real user sessions to understand exactly how they interact with your site. 
                See clicks, scrolls, form interactions, and page navigation in real-time playback.
              </p>
            </div>
            <Button 
              onClick={onGoToSettings}
              className="bg-white text-rose-600 hover:bg-rose-50 rounded-xl h-12 px-6"
            >
              <Settings2 className="w-5 h-5 mr-2" />
              Enable in Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            icon: Code,
            title: "1. Enable Recording",
            description: "Turn on Session Replay in Settings > Features and configure sample rate and privacy settings.",
            color: "from-blue-500 to-cyan-500"
          },
          {
            icon: Shield,
            title: "2. Privacy First",
            description: "Automatically mask sensitive inputs, credit cards, and PII. Comply with GDPR and privacy laws.",
            color: "from-emerald-500 to-teal-500"
          },
          {
            icon: Play,
            title: "3. Watch & Analyze",
            description: "Replay sessions to identify UX issues, bugs, and conversion blockers. Filter by user, page, or errors.",
            color: "from-purple-500 to-indigo-500"
          }
        ].map((step, i) => (
          <Card key={i} className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardContent className="p-6">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4`}>
                <step.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Technical Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5 text-amber-500" />
              How Session Replay Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { title: "DOM Mutation Recording", desc: "Records all DOM changes using MutationObserver API" },
                { title: "User Interactions", desc: "Captures mouse movements, clicks, scrolls, and keyboard inputs" },
                { title: "Network Requests", desc: "Logs XHR/Fetch requests with timing data (optional)" },
                { title: "Console Errors", desc: "Captures JavaScript errors and console messages" },
                { title: "Compressed Storage", desc: "Data is compressed and sent in batches to minimize impact" }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code className="w-5 h-5 text-blue-500" />
              Integration Code
            </CardTitle>
            <CardDescription>
              Add this after enabling Session Replay in settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative group">
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-sm">
                <code>{replayCode}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2 text-slate-400 hover:text-white"
                onClick={copyCode}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              <Info className="w-3 h-3 inline mr-1" />
              The tracking script automatically handles replay when enabled in settings.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Amplitude Comparison */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
              <BookOpen className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Similar to Amplitude Session Replay</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Our Session Replay works similarly to Amplitude's implementation. It uses a lightweight recording 
                library that captures DOM mutations, user interactions, and network activity. The recordings are 
                compressed and stored securely, then reconstructed for playback in the dashboard.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Privacy Masking", "Error Detection", "User Identification", "Mobile Support", "Segment Filtering"].map((feature) => (
                  <span key={feature} className="text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded-full">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SessionReplaysPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params.workspace as string;
  
  const [replays, setReplays] = useState<SessionReplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReplay, setSelectedReplay] = useState<SessionReplay | null>(null);
  const [search, setSearch] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const checkSettings = async () => {
      try {
        const settings = await api.getWorkspaceSettings();
        setIsEnabled(settings.replay_enabled || false);
        
        if (settings.replay_enabled) {
          // TODO: Fetch replays from API when endpoint is available
          setReplays([]);
          setLoading(false);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to check settings:", err);
        setIsEnabled(false);
        setLoading(false);
      }
      setCheckingStatus(false);
    };

    checkSettings();
  }, []);

  const filteredReplays = replays.filter((replay) => {
    if (search && !replay.entry_url.toLowerCase().includes(search.toLowerCase()) && 
        !replay.session_id.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (deviceFilter && replay.device_type !== deviceFilter) {
      return false;
    }
    return true;
  });

  if (checkingStatus) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl">
                <Video className="w-6 h-6 text-white" />
              </div>
              Session Replay
            </h1>
            <p className="text-muted-foreground mt-1">
              Watch recordings of user sessions to understand behavior
            </p>
          </div>
        </div>
        
        <SetupGuide onGoToSettings={() => router.push(`/${workspaceSlug}/settings?tab=features`)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl">
              <Video className="w-6 h-6 text-white" />
            </div>
            Session Replay
          </h1>
          <p className="text-muted-foreground mt-1">
            Watch recordings of user sessions to understand behavior
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl"
            onClick={() => router.push(`/${workspaceSlug}/settings?tab=features`)}
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Configure
          </Button>
          <Button 
            className="rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700"
            onClick={() => {
              setLoading(true);
              // TODO: Fetch replays from API when endpoint is available
              setReplays([]);
              setLoading(false);
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Recordings", value: replays.length.toString(), icon: Video, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-900/20" },
          { label: "Avg Duration", value: replays.length > 0 ? formatDuration(replays.reduce((sum, r) => sum + r.duration_ms, 0) / replays.length) : "0:00", icon: Clock, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Sessions with Errors", value: replays.filter(r => r.error_count > 0).length.toString(), icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
          { label: "Unique Users", value: new Set(replays.map(r => r.user_id || r.anon_id)).size.toString(), icon: User, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by URL or session ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: null, label: "All Devices" },
            { id: "desktop", label: "Desktop", icon: Monitor },
            { id: "mobile", label: "Mobile", icon: Smartphone },
            { id: "tablet", label: "Tablet", icon: Tablet },
          ].map((device) => (
            <Button
              key={device.id || "all"}
              variant={deviceFilter === device.id ? "default" : "outline"}
              size="sm"
              onClick={() => setDeviceFilter(device.id)}
              className="rounded-xl"
            >
              {device.icon && <device.icon className="w-4 h-4 mr-2" />}
              {device.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Replays List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredReplays.length === 0 ? (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardContent className="py-12 text-center">
            <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No recordings found</h3>
            <p className="text-sm text-muted-foreground">
              {search ? "Try adjusting your search" : "Recordings will appear here as users visit your site"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredReplays.map((replay) => (
            <Card
              key={replay.id}
              className="border-0 shadow-lg bg-white dark:bg-slate-800/50 hover:shadow-xl transition-shadow cursor-pointer group"
              onClick={() => setSelectedReplay(replay)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30 rounded-xl flex items-center justify-center">
                        <Play className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                      </div>
                      {replay.error_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {replay.error_count}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold group-hover:text-rose-600 transition-colors">
                        {replay.entry_url}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DeviceIcon type={replay.device_type} />
                          {replay.browser}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {replay.city}, {replay.country}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(replay.duration_ms)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {replay.page_count} pages
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(replay.started_at)}, {formatTime(replay.started_at)}
                        {replay.user_id && <span className="ml-2">• {replay.user_id}</span>}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-rose-600 transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Player Modal */}
      {selectedReplay && (
        <ReplayPlayer replay={selectedReplay} onClose={() => setSelectedReplay(null)} />
      )}
    </div>
  );
}
