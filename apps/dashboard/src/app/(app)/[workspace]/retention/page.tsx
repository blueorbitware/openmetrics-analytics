"use client";

import { useState, useEffect } from "react";
import { api, RetentionReportResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPercentage, getDateRange, formatDate } from "@/lib/utils";
import { 
  Play, BarChart3, Users, TrendingUp, Calendar, ChevronDown,
  Loader2, RefreshCw, Download, Info
} from "lucide-react";
import { cn } from "@/lib/utils";

const COMMON_EVENTS = [
  "page_view",
  "sign_up",
  "login",
  "add_to_cart",
  "purchase",
  "cta_click",
  "form_submit",
  "session_start",
];

export default function RetentionPage() {
  const [dateRange, setDateRange] = useState("30d");
  const [loading, setLoading] = useState(false);
  const [startEvent, setStartEvent] = useState("sign_up");
  const [returnEvent, setReturnEvent] = useState("page_view");
  const [data, setData] = useState<RetentionReportResponse | null>(null);
  const [showStartDropdown, setShowStartDropdown] = useState(false);
  const [showReturnDropdown, setShowReturnDropdown] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const checkProject = () => {
      const pid = localStorage.getItem("selected_project");
      if (pid) {
        setProjectId(pid);
        return true;
      }
      return false;
    };
    
    if (!checkProject()) {
      const interval = setInterval(() => {
        if (checkProject()) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  const runRetention = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { start, end } = getDateRange(dateRange);

      const response = await api.reportRetention({
        project_id: projectId,
        start_event: startEvent,
        return_event: returnEvent,
        time_range: { start: start.toISOString(), end: end.toISOString() },
        retention_period: "day",
        periods: 8,
      });

      setData(response);
    } catch (err) {
      console.error("Failed to run retention:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRetentionColor = (value: number): string => {
    if (value >= 80) return "bg-emerald-500";
    if (value >= 60) return "bg-emerald-400";
    if (value >= 40) return "bg-amber-400";
    if (value >= 20) return "bg-orange-400";
    return "bg-red-400";
  };

  const getRetentionBg = (value: number): string => {
    if (value >= 80) return "from-emerald-500 to-emerald-600";
    if (value >= 60) return "from-emerald-400 to-emerald-500";
    if (value >= 40) return "from-amber-400 to-amber-500";
    if (value >= 20) return "from-orange-400 to-orange-500";
    return "from-red-400 to-red-500";
  };

  const avgRetention = data?.average 
    ? (data.average.reduce((a, b) => a + b, 0) / data.average.length).toFixed(1)
    : "0";
  
  const totalCohorts = data?.cohorts.length || 0;
  const totalUsers = data?.cohorts.reduce((sum, c) => sum + c.cohort_size, 0) || 0;

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            Retention Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Measure how well you retain users over time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["7d", "30d", "90d"].map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange(range)}
              className="rounded-lg"
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Cohorts", value: totalCohorts.toString(), icon: Calendar, color: "text-violet-500" },
            { label: "Total Users", value: totalUsers.toLocaleString(), icon: Users, color: "text-blue-500" },
            { label: "Avg Retention", value: `${avgRetention}%`, icon: TrendingUp, color: "text-emerald-500" },
            { label: "Day 7 Retention", value: data.average[7] ? `${data.average[7].toFixed(1)}%` : "N/A", icon: BarChart3, color: "text-amber-500" },
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
      )}

      {/* Configuration Card */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-muted-foreground" />
            Retention Configuration
          </CardTitle>
          <CardDescription>
            Configure which events define user cohorts and returns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Start Event */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Start Event (Cohort Entry)</Label>
              <div className="relative">
                <Input
                  placeholder="e.g., sign_up"
                  value={startEvent}
                  onChange={(e) => setStartEvent(e.target.value)}
                  className="h-11 rounded-xl pr-10"
                />
                <button
                  onClick={() => setShowStartDropdown(!showStartDropdown)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showStartDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                    {COMMON_EVENTS.map((event) => (
                      <button
                        key={event}
                        onClick={() => {
                          setStartEvent(event);
                          setShowStartDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        {event}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                The event that defines when a user enters a cohort
              </p>
            </div>

            {/* Return Event */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Return Event</Label>
              <div className="relative">
                <Input
                  placeholder="e.g., page_view"
                  value={returnEvent}
                  onChange={(e) => setReturnEvent(e.target.value)}
                  className="h-11 rounded-xl pr-10"
                />
                <button
                  onClick={() => setShowReturnDropdown(!showReturnDropdown)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showReturnDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                    {COMMON_EVENTS.map((event) => (
                      <button
                        key={event}
                        onClick={() => {
                          setReturnEvent(event);
                          setShowReturnDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        {event}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                The event that counts as user returning
              </p>
            </div>
          </div>

          <Button 
            onClick={runRetention} 
            disabled={loading || !projectId} 
            className="w-full mt-6 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Run Retention Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {data && data.cohorts.length > 0 && (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Retention Matrix</CardTitle>
                <CardDescription>
                  Cohort retention over {data.average.length} days
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="rounded-lg">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left p-3 font-semibold text-sm">Cohort</th>
                    <th className="text-left p-3 font-semibold text-sm">Users</th>
                    {Array.from({ length: 8 }, (_, i) => (
                      <th key={i} className="text-center p-3 font-semibold text-sm">
                        Day {i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.cohorts.map((cohort, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-medium text-sm">
                        {formatDate(cohort.cohort_date)}
                      </td>
                      <td className="p-3 text-muted-foreground text-sm">
                        {cohort.cohort_size.toLocaleString()}
                      </td>
                      {cohort.retention_data.map((value, j) => (
                        <td key={j} className="p-2">
                          <div
                            className={cn(
                              "w-full h-10 rounded-lg flex items-center justify-center text-white text-sm font-medium bg-gradient-to-br shadow-sm",
                              getRetentionBg(value)
                            )}
                          >
                            {formatPercentage(value)}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Average Retention Bar */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Average Retention by Day
              </h4>
              <div className="flex gap-2">
                {data.average.map((value, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div
                      className={cn(
                        "h-16 rounded-xl flex items-center justify-center text-white font-bold bg-gradient-to-br shadow-md",
                        getRetentionBg(value)
                      )}
                    >
                      {formatPercentage(value)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 font-medium">Day {i}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-6 text-right">
              Query completed in {data.meta.query_time_ms}ms
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!data && !loading && (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto bg-violet-100 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-violet-600" />
            </div>
            <h3 className="text-lg font-semibold">Run Your First Analysis</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Configure the start and return events above, then click "Run Retention Analysis" to see how well you retain users.
            </p>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {data && data.cohorts.length === 0 && (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-4">
              <Info className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold">No Data Found</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              No retention data found for the selected criteria. Try adjusting the events or time range.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
