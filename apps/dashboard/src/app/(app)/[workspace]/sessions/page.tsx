"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Activity, Search, Clock, Globe, Smartphone, Monitor, Tablet,
  MapPin, ChevronRight, Eye, Filter, Download, Loader2, RefreshCw,
  MousePointer, FileText, AlertCircle, Play, ExternalLink, User
} from "lucide-react";

interface Session {
  id: string;
  session_id: string;
  anon_id: string;
  user_id?: string;
  started_at: string;
  ended_at?: string;
  duration_ms: number;
  page_count: number;
  event_count: number;
  entry_url: string;
  exit_url?: string;
  country?: string;
  city?: string;
  device_type: string;
  browser: string;
  os: string;
  referrer_source?: string;
  referrer_category?: string;
  is_bounce: boolean;
}

// No mock data - sessions will be fetched from API when available
const MOCK_SESSIONS: Session[] = [];

const DeviceIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "mobile":
      return <Smartphone className="w-4 h-4" />;
    case "tablet":
      return <Tablet className="w-4 h-4" />;
    default:
      return <Monitor className="w-4 h-4" />;
  }
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

const ReferrerBadge = ({ category }: { category?: string }) => {
  const colors: Record<string, string> = {
    search: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    social: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    direct: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
    referral: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
  
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${colors[category || "direct"] || colors.direct}`}>
      {category || "direct"}
    </span>
  );
};

export default function SessionsPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params.workspace as string;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Fetch sessions from API when endpoint is available
    setSessions([]);
    setLoading(false);
  }, []);

  const filteredSessions = sessions.filter((session) => {
    if (search && !session.session_id.toLowerCase().includes(search.toLowerCase()) &&
        !session.entry_url.toLowerCase().includes(search.toLowerCase()) &&
        !session.user_id?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (deviceFilter && session.device_type !== deviceFilter) {
      return false;
    }
    return true;
  });

  const stats = {
    total: sessions.length,
    avgDuration: sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + s.duration_ms, 0) / sessions.length) : 0,
    bounceRate: sessions.length > 0 ? Math.round((sessions.filter(s => s.is_bounce).length / sessions.length) * 100) : 0,
    avgPages: sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + s.page_count, 0) / sessions.length) : 0,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            Sessions
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse and analyze individual user sessions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            className="rounded-xl"
            onClick={() => {
              setLoading(true);
              // TODO: Fetch sessions from API when endpoint is available
              setSessions([]);
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
          { label: "Total Sessions", value: stats.total.toLocaleString(), icon: Activity, color: "text-emerald-500" },
          { label: "Avg Duration", value: formatDuration(stats.avgDuration), icon: Clock, color: "text-blue-500" },
          { label: "Bounce Rate", value: `${stats.bounceRate}%`, icon: AlertCircle, color: "text-amber-500" },
          { label: "Avg Pages/Session", value: stats.avgPages.toFixed(1), icon: FileText, color: "text-purple-500" },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-slate-100 dark:bg-slate-900 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
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
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by session ID, URL, or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={deviceFilter === null ? "default" : "outline"}
                onClick={() => setDeviceFilter(null)}
                className="rounded-lg"
              >
                All
              </Button>
              <Button
                variant={deviceFilter === "desktop" ? "default" : "outline"}
                onClick={() => setDeviceFilter("desktop")}
                className="rounded-lg"
              >
                <Monitor className="w-4 h-4 mr-2" />
                Desktop
              </Button>
              <Button
                variant={deviceFilter === "mobile" ? "default" : "outline"}
                onClick={() => setDeviceFilter("mobile")}
                className="rounded-lg"
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Mobile
              </Button>
              <Button
                variant={deviceFilter === "tablet" ? "default" : "outline"}
                onClick={() => setDeviceFilter("tablet")}
                className="rounded-lg"
              >
                <Tablet className="w-4 h-4 mr-2" />
                Tablet
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardContent className="p-12 text-center">
            <Activity className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mt-4">No sessions found</h3>
            <p className="text-muted-foreground mt-2">
              Try adjusting your search or filter criteria
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <Card
              key={session.id}
              className="border-0 shadow-lg bg-white dark:bg-slate-800/50 hover:shadow-xl transition-shadow cursor-pointer group"
              onClick={() => setSelectedSession(selectedSession?.id === session.id ? null : session)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      session.is_bounce 
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" 
                        : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                    }`}>
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{session.entry_url}</span>
                        <ReferrerBadge category={session.referrer_category} />
                        {session.is_bounce && (
                          <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                            Bounce
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DeviceIcon type={session.device_type} />
                          {session.browser}
                        </span>
                        {session.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {session.city}, {session.country}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(session.duration_ms)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {session.page_count} pages
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">{new Date(session.started_at).toLocaleTimeString()}</p>
                      <p className="text-xs">{new Date(session.started_at).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${selectedSession?.id === session.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Expanded details */}
                {selectedSession?.id === session.id && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Session ID</p>
                        <p className="text-sm font-mono truncate">{session.session_id}</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Total Events</p>
                        <p className="text-lg font-semibold">{session.event_count}</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Exit Page</p>
                        <p className="text-sm truncate">{session.exit_url || session.entry_url}</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">User</p>
                        <p className="text-sm truncate">{session.user_id || session.anon_id}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="rounded-lg"
                        onClick={() => router.push(`/${workspaceSlug}/replays?session=${session.session_id}`)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Watch Replay
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="rounded-lg"
                        onClick={() => router.push(`/${workspaceSlug}/events?session=${session.session_id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Events
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="rounded-lg"
                        onClick={() => router.push(`/${workspaceSlug}/users?user=${session.user_id || session.anon_id}`)}
                      >
                        <User className="w-4 h-4 mr-2" />
                        View User
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
