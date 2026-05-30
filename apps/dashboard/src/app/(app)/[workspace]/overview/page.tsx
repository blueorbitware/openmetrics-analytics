"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, EventsReportResponse, SummaryResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNumber, getDateRange } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { 
  Users, Eye, MousePointer, Clock, TrendingUp, TrendingDown, 
  Activity, Globe, Smartphone, Monitor, ArrowUpRight, ArrowDownRight,
  Zap, Target, Radio, RefreshCw, MapPin, Link2, FileText, Timer,
  BarChart3, ExternalLink, ChevronDown, Layers
} from "lucide-react";
import type { Project } from "@/lib/api";

type DateRange = "today" | "7d" | "30d" | "90d";

interface LiveStats {
  activeUsers: number;
  recentPages: Array<{ path: string; title: string; count: number }>;
  recentEvents: Array<{ name: string; path: string; time: string; country: string; device: string }>;
  topCountries: Array<{ country: string; count: number }>;
}

export default function OverviewPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EventsReportResponse | null>(null);
  const [pageViews, setPageViews] = useState<EventsReportResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats>({ activeUsers: 0, recentPages: [], recentEvents: [], topCountries: [] });
  const [liveLoading, setLiveLoading] = useState(true);
  const liveInterval = useRef<NodeJS.Timeout | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("all");
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {});
  }, []);

  const getProjectId = useCallback(async () => {
    if (selectedProjectFilter !== "all") {
      return selectedProjectFilter;
    }
    let projectId = localStorage.getItem("selected_project");
    if (!projectId) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 100));
        projectId = localStorage.getItem("selected_project");
        if (projectId) break;
      }
    }
    return projectId;
  }, [selectedProjectFilter]);

  const loadLiveStats = useCallback(async () => {
    try {
      const projectId = selectedProjectFilter === "all" ? "all" : await getProjectId();
      if (!projectId) return;

      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

      const [recentRaw, last30Raw] = await Promise.all([
        api.getRawEvents({ project_id: projectId, limit: 20 }).catch(() => ({ events: [], total: 0, limit: 20, offset: 0 })),
        api.reportEvents({
          project_id: projectId,
          time_range: { start: thirtyMinAgo.toISOString(), end: now.toISOString() },
          interval: "hour",
        }).catch(() => null),
      ]);

      const recentEvents = recentRaw.events.slice(0, 10).map(e => ({
        name: e.event_name,
        path: e.path || e.url || "",
        time: new Date(e.timestamp).toLocaleTimeString(),
        country: e.country || "",
        device: e.device_type || "",
      }));

      const pageCounts: Record<string, { path: string; title: string; count: number }> = {};
      recentRaw.events.forEach(e => {
        const key = e.path || e.url || "/";
        if (!pageCounts[key]) pageCounts[key] = { path: key, title: e.title || key, count: 0 };
        pageCounts[key].count++;
      });
      const recentPages = Object.values(pageCounts).sort((a, b) => b.count - a.count).slice(0, 8);

      const countryCounts: Record<string, number> = {};
      recentRaw.events.forEach(e => {
        if (e.country) {
          countryCounts[e.country] = (countryCounts[e.country] || 0) + 1;
        }
      });
      const topCountries = Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const activeUsers = last30Raw?.meta?.total_unique_users || 0;

      setLiveStats({ activeUsers, recentPages, recentEvents, topCountries });
    } catch (err) {
      console.error("Failed to load live stats:", err);
    } finally {
      setLiveLoading(false);
    }
  }, [getProjectId]);

  useEffect(() => {
    loadLiveStats();
    liveInterval.current = setInterval(loadLiveStats, 15000);
    return () => {
      if (liveInterval.current) clearInterval(liveInterval.current);
    };
  }, [loadLiveStats]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const projectId = selectedProjectFilter === "all" ? "all" : await getProjectId();
        if (!projectId) {
          setLoading(false);
          return;
        }

        const { start, end } = getDateRange(dateRange);

        const [eventsRes, pageViewsRes, summaryRes] = await Promise.all([
          api.reportEvents({
            project_id: projectId,
            time_range: { start: start.toISOString(), end: end.toISOString() },
            interval: dateRange === "today" ? "hour" : "day",
          }),
          api.reportEvents({
            project_id: projectId,
            event_name: "page_view",
            time_range: { start: start.toISOString(), end: end.toISOString() },
            interval: dateRange === "today" ? "hour" : "day",
          }),
          api.getSummary({
            project_id: projectId,
            start: start.toISOString(),
            end: end.toISOString(),
          }).catch(() => null),
        ]);

        setData(eventsRes);
        setPageViews(pageViewsRes);
        setSummary(summaryRes);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dateRange, selectedProjectFilter, getProjectId]);

  const chartData = data?.data.map((d) => ({
    date: new Date(d.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    events: d.count,
    users: d.unique_users,
  })) || [];

  const totalEvents = data?.meta.total_count || 0;
  const totalUsers = data?.meta.total_unique_users || 0;
  const totalPageViews = pageViews?.meta.total_count || 0;
  const avgEventsPerUser = totalUsers > 0 ? (totalEvents / totalUsers).toFixed(1) : "0";

  const hasData = totalEvents > 0;
  const bounceRate = summary?.bounce_rate ?? null;
  const avgSession = summary?.avg_session_duration_seconds ?? null;
  const avgTimeOnPage = summary?.avg_time_on_page_seconds ?? null;
  const pagesPerSession = summary?.avg_page_views_per_session ?? null;
  const deviceSplit = summary?.by_device || [];
  const totalDeviceCount = deviceSplit.reduce((sum, d) => sum + d.count, 0);
  const topSources = summary?.top_sources || [];
  const topPages = summary?.top_pages || [];
  const topParameters = summary?.top_parameters || [];
  const byCountry = summary?.by_country || [];
  const byBrowser = summary?.by_browser || [];

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const kpis = [
    {
      title: "Total Events",
      value: formatNumber(totalEvents),
      icon: Activity,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Unique Users",
      value: formatNumber(totalUsers),
      icon: Users,
      color: "from-emerald-500 to-emerald-600",
      bgColor: "bg-emerald-500/10",
      textColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Page Views",
      value: formatNumber(totalPageViews),
      icon: Eye,
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-500/10",
      textColor: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Bounce Rate",
      value: bounceRate !== null ? `${bounceRate.toFixed(1)}%` : "-",
      icon: TrendingDown,
      color: "from-red-500 to-red-600",
      bgColor: "bg-red-500/10",
      textColor: "text-red-600 dark:text-red-400",
    },
    {
      title: "Avg. Time on Site",
      value: avgSession !== null ? formatDuration(avgSession) : "-",
      icon: Timer,
      color: "from-cyan-500 to-cyan-600",
      bgColor: "bg-cyan-500/10",
      textColor: "text-cyan-600 dark:text-cyan-400",
    },
    {
      title: "Avg. Time on Page",
      value: avgTimeOnPage !== null ? formatDuration(avgTimeOnPage) : "-",
      icon: Clock,
      color: "from-amber-500 to-amber-600",
      bgColor: "bg-amber-500/10",
      textColor: "text-amber-600 dark:text-amber-400",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded mt-2 animate-pulse" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Overview</h1>
            <p className="text-muted-foreground mt-1">
              Your analytics at a glance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Project Filter */}
          <div className="relative">
            <button
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-sm min-w-[160px]"
            >
              <Layers className="w-4 h-4 text-slate-500" />
              <span className="truncate">
                {selectedProjectFilter === "all"
                  ? "All Projects"
                  : projects.find(p => p.id === selectedProjectFilter)?.name || "Select Project"}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${projectDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {projectDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProjectDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                  <div className="p-1">
                    <button
                      onClick={() => { setSelectedProjectFilter("all"); setProjectDropdownOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        selectedProjectFilter === "all"
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                          : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>All Projects</span>
                      {selectedProjectFilter === "all" && (
                        <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">Active</span>
                      )}
                    </button>
                    {projects.length > 0 && <div className="border-t border-slate-100 dark:border-slate-700 my-1" />}
                    {projects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => { setSelectedProjectFilter(project.id); setProjectDropdownOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          selectedProjectFilter === project.id
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        <Globe className="w-4 h-4 text-slate-400" />
                        <div className="text-left truncate">
                          <div className="truncate">{project.name}</div>
                          {project.domain && <div className="text-xs text-muted-foreground truncate">{project.domain}</div>}
                        </div>
                        {selectedProjectFilter === project.id && (
                          <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full shrink-0">Active</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Date Range Filter */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            {(["today", "7d", "30d", "90d"] as DateRange[]).map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setDateRange(range)}
                className={`rounded-lg ${dateRange === range ? "shadow-md" : ""}`}
              >
                {range === "today" ? "Today" : range}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="relative overflow-hidden border-0 shadow-lg bg-white dark:bg-slate-800/50 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4">
              <div className={`p-2 rounded-lg ${kpi.bgColor} w-fit`}>
                <kpi.icon className={`w-5 h-5 ${kpi.textColor}`} />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.title}</p>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Now Section */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Live Active Users */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                <span className="text-sm font-medium text-emerald-100">LIVE</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <Radio className="w-6 h-6" />
              <span className="font-medium text-emerald-100">Active Now</span>
            </div>
            <p className="text-5xl font-bold">{liveStats.activeUsers}</p>
            <p className="text-sm text-emerald-100 mt-2">visitors in last 30 min</p>
          </CardContent>
        </Card>

        {/* Live Pages Being Viewed */}
        <Card className="lg:col-span-2 border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-500" />
                Active Pages
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={loadLiveStats} className="text-muted-foreground">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {liveStats.recentPages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent page views yet. Visit your tracked site to see live data.</p>
            ) : (
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {liveStats.recentPages.map((page, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="text-sm truncate" title={page.title || page.path}>{page.title || page.path}</span>
                    </div>
                    <span className="text-sm font-semibold ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{page.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Event Feed */}
      {liveStats.recentEvents.length > 0 && (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Recent Events
              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-muted-foreground px-2 py-0.5 rounded-full ml-1">auto-refreshes every 15s</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {liveStats.recentEvents.map((event, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-sm">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    event.name === "page_view" ? "bg-blue-500" : 
                    event.name === "session_start" ? "bg-emerald-500" : "bg-amber-500"
                  }`} />
                  <span className="font-medium w-28 truncate">{event.name}</span>
                  <span className="text-muted-foreground truncate flex-1">{event.path}</span>
                  {event.country && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                      <MapPin className="w-3 h-3" />
                      {event.country}
                    </span>
                  )}
                  {event.device && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {event.device === "desktop" ? "💻" : event.device === "mobile" ? "📱" : "📟"}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">{event.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Traffic Sources & UTM Breakdown */}
      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Traffic Sources */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-blue-500" />
              Traffic Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No traffic source data yet</p>
            ) : (
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <div className="w-full lg:w-1/2 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topSources.slice(0, 8).map((s, i) => ({ name: s.source || "Direct", value: s.count, fill: COLORS[i % COLORS.length] }))}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                        paddingAngle={2} dataKey="value"
                      >
                        {topSources.slice(0, 8).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full lg:w-1/2 space-y-2">
                  {topSources.slice(0, 6).map((source, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="truncate">{source.source || "Direct"}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-muted-foreground shrink-0">{source.category}</span>
                      </div>
                      <span className="font-semibold ml-2">{source.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* URL Parameters / UTM Breakdown */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Link2 className="w-5 h-5 text-purple-500" />
              URL Parameters & UTM
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topParameters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No URL parameters tracked yet. UTM and custom parameters will appear here.</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {topParameters.map((param, i) => {
                  const maxCount = topParameters[0]?.count || 1;
                  const pct = Math.round((param.count / maxCount) * 100);
                  return (
                    <div key={i} className="relative">
                      <div className="absolute inset-0 bg-purple-500/10 rounded-lg" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center justify-between p-2.5 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded shrink-0">
                            {param.parameter}
                          </span>
                          <span className="text-sm truncate">{param.value}</span>
                        </div>
                        <span className="text-sm font-semibold ml-2 shrink-0">{param.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Pages */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-500" />
            Top Pages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topPages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No page data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Page</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Views</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Unique</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Avg. Time</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Bounce</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-32">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.slice(0, 10).map((page, i) => {
                    const maxViews = topPages[0]?.views || 1;
                    const pct = Math.round((page.views / maxViews) * 100);
                    return (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-2">
                          <span className="text-sm truncate block max-w-[300px]" title={page.path}>{page.path}</span>
                        </td>
                        <td className="text-right py-2.5 px-2 font-medium">{formatNumber(page.views)}</td>
                        <td className="text-right py-2.5 px-2 text-muted-foreground">{formatNumber(page.unique_views)}</td>
                        <td className="text-right py-2.5 px-2 text-muted-foreground">{formatDuration(page.avg_time_seconds)}</td>
                        <td className="text-right py-2.5 px-2">
                          <span className={page.bounce_rate > 70 ? "text-red-500" : page.bounce_rate > 50 ? "text-amber-500" : "text-emerald-500"}>
                            {page.bounce_rate.toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Countries & Browsers */}
      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Top Countries */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-500" />
              Top Countries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byCountry.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No country data yet</p>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCountry.slice(0, 8)} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="country" tick={{ fontSize: 12 }} width={55} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Browsers */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-500" />
              Browsers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byBrowser.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No browser data yet</p>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byBrowser.slice(0, 8)} layout="vertical" margin={{ left: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="browser" tick={{ fontSize: 12 }} width={65} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Events & Users</CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">Events</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Users</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] lg:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="events"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorEvents)"
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorUsers)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="space-y-4 lg:space-y-6">
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Bounce Rate", value: bounceRate !== null ? `${bounceRate.toFixed(1)}%` : "-", icon: TrendingDown, color: "text-red-500" },
                { label: "Avg. Session", value: avgSession !== null ? `${Math.round(avgSession)}s` : "-", icon: Clock, color: "text-blue-500" },
                { label: "Pages/Session", value: pagesPerSession !== null ? pagesPerSession.toFixed(1) : "-", icon: Eye, color: "text-purple-500" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                  <span className="font-semibold text-muted-foreground">{stat.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Device Split</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Desktop", key: "desktop", icon: Monitor, color: "bg-blue-500" },
                { label: "Mobile", key: "mobile", icon: Smartphone, color: "bg-emerald-500" },
                { label: "Tablet", key: "tablet", icon: Globe, color: "bg-purple-500" },
              ].map((device) => {
                const found = deviceSplit.find(d => d.device_type?.toLowerCase() === device.key);
                const pct = totalDeviceCount > 0 && found ? Math.round((found.count / totalDeviceCount) * 100) : 0;
                return (
                  <div key={device.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <device.icon className="w-4 h-4 text-muted-foreground" />
                        <span>{device.label}</span>
                      </div>
                      <span className="font-medium text-muted-foreground">{hasData ? `${pct}%` : "-"}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${device.color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
