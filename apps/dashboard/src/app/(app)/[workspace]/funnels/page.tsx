"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api, FunnelReportResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, formatPercentage, getDateRange } from "@/lib/utils";
import { 
  Plus, X, Play, Save, Trash2, ChevronDown, FolderOpen, GitBranch, Loader2, 
  TrendingDown, Users, Target, MoreVertical, Edit, Copy, Calendar, Search,
  ArrowRight, ArrowDown, Check, Clock, BarChart3, Eye, RefreshCw
} from "lucide-react";

interface SavedFunnel {
  id: string;
  name: string;
  steps: string[];
  createdAt: string;
  lastRun?: string;
}

const COMMON_EVENTS = [
  "page_view",
  "cta_click",
  "sign_up",
  "login",
  "add_to_cart",
  "begin_checkout",
  "purchase",
  "form_submit",
  "scroll_depth",
  "outbound_link_click",
  "banner_impression",
  "banner_cta_click",
];

export default function FunnelsPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params.workspace as string;

  const [dateRange, setDateRange] = useState("30d");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<string[]>(["page_view", "cta_click"]);
  const [newStep, setNewStep] = useState("");
  const [data, setData] = useState<FunnelReportResponse | null>(null);
  const [savedFunnels, setSavedFunnels] = useState<SavedFunnel[]>([]);
  const [funnelName, setFunnelName] = useState("");
  const [showEventDropdown, setShowEventDropdown] = useState<number | null>(null);
  const [projectEvents, setProjectEvents] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingFunnel, setEditingFunnel] = useState<SavedFunnel | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadSavedFunnels = () => {
      const saved = localStorage.getItem("saved_funnels");
      if (saved) {
        try {
          setSavedFunnels(JSON.parse(saved));
        } catch {}
      }
    };

    const loadProjectEvents = async () => {
      const pid = localStorage.getItem("selected_project");
      if (!pid) {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 100));
          const newPid = localStorage.getItem("selected_project");
          if (newPid) {
            setProjectId(newPid);
            break;
          }
        }
      } else {
        setProjectId(pid);
      }
    };

    loadSavedFunnels();
    loadProjectEvents();
  }, []);

  const saveFunnel = () => {
    if (!funnelName || steps.length < 2) return;

    const newFunnel: SavedFunnel = {
      id: Date.now().toString(),
      name: funnelName,
      steps: [...steps],
      createdAt: new Date().toISOString(),
    };

    const updated = [newFunnel, ...savedFunnels];
    setSavedFunnels(updated);
    localStorage.setItem("saved_funnels", JSON.stringify(updated));
    setFunnelName("");
    setShowSaveModal(false);
  };

  const loadFunnel = (funnel: SavedFunnel) => {
    setSteps([...funnel.steps]);
    setFunnelName(funnel.name);
    setData(null);
  };

  const deleteFunnel = (id: string) => {
    if (!confirm("Delete this funnel?")) return;
    const updated = savedFunnels.filter(f => f.id !== id);
    setSavedFunnels(updated);
    localStorage.setItem("saved_funnels", JSON.stringify(updated));
    setActiveMenu(null);
  };

  const duplicateFunnel = (funnel: SavedFunnel) => {
    const newFunnel: SavedFunnel = {
      id: Date.now().toString(),
      name: `${funnel.name} (Copy)`,
      steps: [...funnel.steps],
      createdAt: new Date().toISOString(),
    };
    const updated = [newFunnel, ...savedFunnels];
    setSavedFunnels(updated);
    localStorage.setItem("saved_funnels", JSON.stringify(updated));
    setActiveMenu(null);
  };

  const addStep = (eventName?: string) => {
    const event = eventName || newStep;
    if (event && !steps.includes(event)) {
      setSteps([...steps, event]);
      setNewStep("");
    }
    setShowEventDropdown(null);
  };

  const updateStep = (index: number, eventName: string) => {
    const updated = [...steps];
    updated[index] = eventName;
    setSteps(updated);
    setShowEventDropdown(null);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const runFunnel = async () => {
    if (steps.length < 2 || !projectId) return;

    setLoading(true);
    try {
      const { start, end } = getDateRange(dateRange);

      const response = await api.reportFunnel({
        project_id: projectId,
        steps: steps.map((event_name) => ({ event_name })),
        time_range: { start: start.toISOString(), end: end.toISOString() },
        conversion_window_hours: 168,
      });

      setData(response);
      
      // Update lastRun for saved funnel if matching
      const matchingFunnel = savedFunnels.find(f => 
        f.steps.length === steps.length && f.steps.every((s, i) => s === steps[i])
      );
      if (matchingFunnel) {
        const updated = savedFunnels.map(f => 
          f.id === matchingFunnel.id ? { ...f, lastRun: new Date().toISOString() } : f
        );
        setSavedFunnels(updated);
        localStorage.setItem("saved_funnels", JSON.stringify(updated));
      }
    } catch (err) {
      console.error("Failed to run funnel:", err);
    } finally {
      setLoading(false);
    }
  };

  const allEvents = [...new Set([...COMMON_EVENTS, ...projectEvents])].sort();
  
  const filteredFunnels = savedFunnels.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const overallConversion = data?.overall_conversion || 0;
  const totalSteps = data?.steps.length || 0;
  const biggestDropoff = data?.steps.reduce((max, step, i) => {
    if (i === 0) return max;
    return step.dropoff_rate > max ? step.dropoff_rate : max;
  }, 0) || 0;

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
              <GitBranch className="w-6 h-6 text-white" />
            </div>
            Funnel Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyze conversion paths and identify drop-off points
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

      {/* Stats Cards - Only show when data exists */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Overall Conversion", value: `${overallConversion.toFixed(1)}%`, icon: Target, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            { label: "Funnel Steps", value: totalSteps.toString(), icon: GitBranch, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
            { label: "Biggest Drop-off", value: `${biggestDropoff.toFixed(1)}%`, icon: TrendingDown, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
            { label: "Entry Users", value: data.steps[0]?.count.toLocaleString() || "0", icon: Users, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
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
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Funnel Builder */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <GitBranch className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    Build Funnel
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Define your conversion path by selecting events in order
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveModal(true)}
                  disabled={steps.length < 2}
                  className="rounded-lg"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Funnel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={index} className="group">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
                      <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white font-bold shadow-sm">
                        {index + 1}
                      </div>
                      
                      <div className="flex-1 relative">
                        <button
                          onClick={() => setShowEventDropdown(showEventDropdown === index ? null : index)}
                          className="w-full text-left px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between hover:border-purple-400 dark:hover:border-purple-600 transition-colors"
                        >
                          <span className="font-medium">{step}</span>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showEventDropdown === index ? "rotate-180" : ""}`} />
                        </button>
                        
                        {showEventDropdown === index && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                            {allEvents.map((event) => (
                              <button
                                key={event}
                                onClick={() => updateStep(index, event)}
                                className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between ${
                                  event === step ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" : ""
                                }`}
                              >
                                <span>{event}</span>
                                {event === step && <Check className="w-4 h-4" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStep(index)}
                        disabled={steps.length <= 2}
                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {index < steps.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ArrowDown className="w-5 h-5 text-purple-400" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Step */}
                <div className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                  <div className="flex items-center justify-center w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 font-bold">
                    +
                  </div>
                  
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Add event to funnel..."
                      value={newStep}
                      onChange={(e) => setNewStep(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addStep()}
                      onFocus={() => setShowEventDropdown(-1)}
                      className="h-11 rounded-lg"
                    />
                    {showEventDropdown === -1 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                        {allEvents
                          .filter(e => !steps.includes(e))
                          .map((event) => (
                            <button
                              key={event}
                              onClick={() => addStep(event)}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                              {event}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  
                  <Button onClick={() => addStep()} className="rounded-lg" disabled={!newStep}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>

                {/* Run Button */}
                <div className="pt-4">
                  <Button 
                    onClick={runFunnel} 
                    disabled={loading || steps.length < 2 || !projectId} 
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Analyzing Funnel...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        Run Funnel Analysis
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {data && (
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                    Funnel Results
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full font-medium">
                      {formatPercentage(data.overall_conversion)} Conversion
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.steps.map((step, index) => {
                    const widthPercent = data.steps[0].count > 0 
                      ? (step.count / data.steps[0].count) * 100 
                      : 0;
                    const prevStep = index > 0 ? data.steps[index - 1] : null;
                    const dropCount = prevStep ? prevStep.count - step.count : 0;

                    return (
                      <div key={index} className="relative">
                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white font-bold shadow-sm flex-shrink-0">
                            {step.step_number}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-semibold">{step.event_name}</span>
                                {index > 0 && (
                                  <span className="text-sm text-muted-foreground ml-2">
                                    ({formatPercentage(step.conversion_rate)} from step {index})
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-xl font-bold">{formatNumber(step.count)}</span>
                                <span className="text-muted-foreground text-sm ml-1">users</span>
                              </div>
                            </div>
                            
                            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-700 ease-out flex items-center justify-end pr-3"
                                style={{ width: `${Math.max(widthPercent, 3)}%` }}
                              >
                                {widthPercent > 12 && (
                                  <span className="text-white font-medium text-sm">
                                    {formatPercentage(widthPercent)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Drop-off indicator */}
                        {index > 0 && dropCount > 0 && (
                          <div className="absolute -top-2 right-4 flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-full">
                            <TrendingDown className="w-3 h-3" />
                            -{formatNumber(dropCount)} ({formatPercentage(step.dropoff_rate)})
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Saved Funnels - Row Style */}
        <div className="space-y-4">
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                  Saved Funnels
                </CardTitle>
                <span className="text-xs bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-full">
                  {savedFunnels.length}
                </span>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search funnels..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 rounded-lg text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredFunnels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No saved funnels yet</p>
                  <p className="text-xs mt-1">Build a funnel and save it for quick access</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFunnels.map((funnel) => (
                    <div
                      key={funnel.id}
                      className="group p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{funnel.name}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {funnel.steps.length} steps • {funnel.steps[0]} → {funnel.steps[funnel.steps.length - 1]}
                          </p>
                          {funnel.lastRun && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last run: {new Date(funnel.lastRun).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-lg"
                            onClick={() => setActiveMenu(activeMenu === funnel.id ? null : funnel.id)}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                          
                          {activeMenu === funnel.id && (
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                              <button
                                onClick={() => {
                                  loadFunnel(funnel);
                                  setActiveMenu(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Play className="w-4 h-4" />
                                Load
                              </button>
                              <button
                                onClick={() => duplicateFunnel(funnel)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                Duplicate
                              </button>
                              <button
                                onClick={() => deleteFunnel(funnel.id)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Quick Actions Row */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <Button 
                          size="sm" 
                          className="flex-1 h-8 text-xs rounded-lg"
                          onClick={() => {
                            loadFunnel(funnel);
                            setTimeout(() => runFunnel(), 100);
                          }}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Run
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 h-8 text-xs rounded-lg"
                          onClick={() => loadFunnel(funnel)}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
            <CardContent className="p-4">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                Pro Tips
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-3 h-3 mt-0.5 text-purple-500" />
                  Start with page_view to track entry point
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-3 h-3 mt-0.5 text-purple-500" />
                  End with purchase or sign_up for conversion
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-3 h-3 mt-0.5 text-purple-500" />
                  Analyze drop-offs to optimize UX
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Save className="w-5 h-5 text-primary" />
                  Save Funnel
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowSaveModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Funnel Name</Label>
                <Input 
                  value={funnelName} 
                  onChange={(e) => setFunnelName(e.target.value)}
                  placeholder="e.g., Checkout Conversion"
                  className="h-11 rounded-lg"
                />
              </div>
              
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Funnel Steps:</p>
                <div className="flex flex-wrap gap-1">
                  {steps.map((step, i) => (
                    <span key={i} className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded">
                      {i + 1}. {step}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowSaveModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={saveFunnel} disabled={!funnelName}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Funnel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {(showEventDropdown !== null || activeMenu !== null) && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => {
            setShowEventDropdown(null);
            setActiveMenu(null);
          }} 
        />
      )}
    </div>
  );
}
