"use client";

import { useEffect, useState } from "react";
import { api, EventsReportResponse, RawEventsResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber, getDateRange } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { 
  Search, BarChart3, Table, ChevronLeft, ChevronRight, 
  Filter, Download, Eye, MousePointer, Globe, Clock,
  Smartphone, Monitor, MapPin
} from "lucide-react";

type ViewMode = "chart" | "raw";
type DateRange = "7d" | "30d" | "90d";

const sourceColors: Record<string, string> = {
  search: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  social: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  ai: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  video: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  messaging: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  email: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  direct: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400",
  referral: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
};

const eventTypeColors: Record<string, string> = {
  page: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  click: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  ecommerce: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  custom: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
  auth: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function EventsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EventsReportResponse | null>(null);
  const [rawData, setRawData] = useState<RawEventsResponse | null>(null);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawPage, setRawPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const loadProjectId = async () => {
      let pid = localStorage.getItem("selected_project");
      if (!pid) {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 100));
          pid = localStorage.getItem("selected_project");
          if (pid) break;
        }
      }
      setProjectId(pid);
    };
    loadProjectId();
  }, []);

  useEffect(() => {
    if (projectId) {
      if (viewMode === "chart") {
        loadChartData();
      } else {
        loadRawData();
      }
    }
  }, [projectId, dateRange, viewMode]);

  const loadChartData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { start, end } = getDateRange(dateRange);
      const response = await api.reportEvents({
        project_id: projectId,
        time_range: { start: start.toISOString(), end: end.toISOString() },
        interval: "day",
        event_name: searchTerm || undefined,
      });
      setData(response);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRawData = async (page = 0) => {
    if (!projectId) return;
    setRawLoading(true);
    try {
      const response = await api.getRawEvents({
        project_id: projectId,
        event_name: searchTerm || undefined,
        limit: 20,
        offset: page * 20,
      });
      setRawData(response);
      setRawPage(page);
    } catch (err) {
      console.error("Failed to load raw data:", err);
    } finally {
      setRawLoading(false);
    }
  };

  const handleSearch = () => {
    if (viewMode === "chart") {
      loadChartData();
    } else {
      loadRawData(0);
    }
  };

  const chartData = data?.data.map((d) => ({
    date: new Date(d.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    events: d.count,
    users: d.unique_users,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground mt-1">
            Explore and analyze your event data
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <Button
              variant={viewMode === "chart" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("chart")}
              className="rounded-lg"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Charts
            </Button>
            <Button
              variant={viewMode === "raw" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("raw")}
              className="rounded-lg"
            >
              <Table className="w-4 h-4 mr-2" />
              Raw Data
            </Button>
          </div>

          {/* Date Range */}
          <div className="flex items-center bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            {(["7d", "30d", "90d"] as DateRange[]).map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setDateRange(range)}
                className="rounded-lg"
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by event name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 h-11 rounded-xl border-slate-200 dark:border-slate-700"
              />
            </div>
            <Button onClick={handleSearch} className="h-11 px-6 rounded-xl">
              <Filter className="w-4 h-4 mr-2" />
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {viewMode === "chart" ? (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Stats Cards */}
          <div className="lg:col-span-1 space-y-4">
            {[
              { label: "Total Events", value: formatNumber(data?.meta.total_count || 0), icon: MousePointer, color: "text-blue-500" },
              { label: "Unique Users", value: formatNumber(data?.meta.total_unique_users || 0), icon: Globe, color: "text-emerald-500" },
              { label: "Query Time", value: `${data?.meta.query_time_ms || 0}ms`, icon: Clock, color: "text-purple-500" },
            ].map((stat) => (
              <Card key={stat.label} className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900">
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart */}
          <Card className="lg:col-span-3 border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader>
              <CardTitle>Event Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[350px] flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorEventsArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="events"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorEventsArea)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 overflow-hidden">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <CardTitle>Raw Event Data</CardTitle>
              <span className="text-sm text-muted-foreground">
                Showing {(rawData?.events?.length || 0)} of {rawData?.total || 0} events
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rawLoading ? (
              <div className="h-96 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <th className="text-left p-4 font-medium text-muted-foreground">Timestamp</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Event</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Source</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">User</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Path</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Location</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Device</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawData?.events?.map((event) => (
                        <tr key={event.event_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          <td className="p-4">
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.timestamp).toLocaleString()}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="font-medium">{event.event_name}</span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                              eventTypeColors[event.event_type] || eventTypeColors.custom
                            }`}>
                              {event.event_type}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium w-fit ${
                                sourceColors[event.ref_source_category] || sourceColors.referral
                              }`}>
                                {event.ref_source || "Direct"}
                              </span>
                              {event.ref_source_category && event.ref_source_category !== "direct" && (
                                <span className="text-xs text-muted-foreground capitalize">
                                  {event.ref_source_category}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              {event.user_id || event.anon_id.slice(0, 12)}...
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm max-w-[150px] truncate block" title={event.path}>
                              {event.path}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm">{event.country} {event.city}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              {event.device_type === "mobile" ? (
                                <Smartphone className="w-3 h-3 text-muted-foreground" />
                              ) : (
                                <Monitor className="w-3 h-3 text-muted-foreground" />
                              )}
                              <span className="text-sm">{event.browser}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!rawData?.events || rawData.events.length === 0) && (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-muted-foreground">
                            <div className="flex flex-col items-center gap-2">
                              <Table className="w-12 h-12 text-slate-300" />
                              <p>No events found</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {rawData && rawData.total > 20 && (
                  <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-sm text-muted-foreground">
                      Page {rawPage + 1} of {Math.ceil(rawData.total / 20)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadRawData(rawPage - 1)}
                        disabled={rawPage === 0}
                        className="rounded-lg"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadRawData(rawPage + 1)}
                        disabled={(rawPage + 1) * 20 >= rawData.total}
                        className="rounded-lg"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
