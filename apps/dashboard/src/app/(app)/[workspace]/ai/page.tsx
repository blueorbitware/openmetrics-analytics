"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Brain, Sparkles, MessageSquare, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Info, Loader2, Send, History, RefreshCw, X, ChevronRight,
  Lightbulb, BarChart3, Zap, Clock, ArrowRight, Bot, User
} from "lucide-react";
import { api, AIInsight, AIQuery, AIQueryResponse } from "@/lib/api";

const INSIGHT_ICONS: Record<string, React.ElementType> = {
  anomaly: AlertTriangle,
  trend: TrendingUp,
  recommendation: Lightbulb,
  prediction: BarChart3,
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  info: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
  success: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  warning: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
  critical: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
};

const SAMPLE_QUERIES = [
  "How many users visited last week?",
  "What's our bounce rate?",
  "Show me top pages by views",
  "Where does our traffic come from?",
  "What's the conversion rate?",
  "How much revenue this month?",
];

export default function AIPage() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [queryHistory, setQueryHistory] = useState<AIQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [query, setQuery] = useState("");
  const [querying, setQuerying] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<AIQueryResponse | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [insightsData, historyData] = await Promise.all([
        api.getAIInsights({ project_id: projectId!, limit: 20 }),
        api.getAIQueryHistory(10),
      ]);
      setInsights(insightsData);
      setQueryHistory(historyData);
    } catch (error) {
      console.error("Failed to load AI data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async () => {
    if (!projectId) return;
    setGenerating(true);
    try {
      const result = await api.generateInsights(projectId);
      setInsights(prev => [...result.insights, ...prev]);
    } catch (error) {
      console.error("Failed to generate insights:", error);
    } finally {
      setGenerating(false);
    }
  };

  const runQuery = async (queryText: string = query) => {
    if (!queryText.trim() || !projectId) return;
    
    setQuerying(true);
    setCurrentResponse(null);
    
    try {
      const response = await api.runAIQuery(queryText, projectId);
      setCurrentResponse(response);
      setQueryHistory(prev => [{
        id: response.id,
        workspace_id: "",
        user_id: "",
        query_text: queryText,
        generated_sql: response.generated_sql,
        result_summary: response.result_summary,
        result_data: response.result_data,
        tokens_used: response.tokens_used,
        latency_ms: response.latency_ms,
        created_at: new Date().toISOString(),
      }, ...prev.slice(0, 9)]);
      setQuery("");
    } catch (error: any) {
      setCurrentResponse({
        id: "",
        query: queryText,
        result_summary: error.message || "Failed to process query. Please try again.",
        tokens_used: 0,
        latency_ms: 0,
      });
    } finally {
      setQuerying(false);
    }
  };

  const dismissInsight = async (insightId: string) => {
    try {
      await api.dismissInsight(insightId);
      setInsights(prev => prev.filter(i => i.id !== insightId));
    } catch (error) {
      console.error("Failed to dismiss insight:", error);
    }
  };

  if (!projectId || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto text-primary/50 animate-pulse" />
          <p className="text-muted-foreground mt-4">Loading AI features...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
              <Brain className="w-6 h-6 text-white" />
            </div>
            AI Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Natural language queries and automated insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowHistory(!showHistory)}
            className="rounded-xl"
          >
            <History className="w-4 h-4 mr-2" />
            History
          </Button>
          <Button 
            onClick={generateInsights}
            disabled={generating}
            className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Generate Insights
          </Button>
        </div>
      </div>

      {/* Natural Language Query */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Ask a Question</h3>
              <p className="text-sm text-slate-400">Use natural language to query your analytics data</p>
            </div>
          </div>

          <div className="relative">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runQuery()}
              placeholder="e.g., How many unique users visited last week?"
              className="h-14 bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl pr-12 text-lg"
              disabled={querying}
            />
            <Button
              onClick={() => runQuery()}
              disabled={querying || !query.trim()}
              size="icon"
              className="absolute right-2 top-2 h-10 w-10 rounded-lg bg-white/20 hover:bg-white/30"
            >
              {querying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>

          {/* Sample queries */}
          <div className="flex flex-wrap gap-2 mt-4">
            {SAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setQuery(q);
                  inputRef.current?.focus();
                }}
                className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Query Response */}
      {currentResponse && (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <User className="w-4 h-4" />
                  <span>{currentResponse.query}</span>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 mt-3">
                  <p className="text-lg">{currentResponse.result_summary}</p>
                  
                  {currentResponse.result_data && Object.keys(currentResponse.result_data).length > 0 && (
                    <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg">
                      <pre className="text-sm overflow-x-auto">
                        {JSON.stringify(currentResponse.result_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {currentResponse.generated_sql && (
                    <details className="mt-4">
                      <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                        View generated SQL
                      </summary>
                      <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-x-auto">
                        {currentResponse.generated_sql}
                      </pre>
                    </details>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {currentResponse.latency_ms}ms
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {currentResponse.tokens_used} tokens
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Query History Panel */}
      {showHistory && queryHistory.length > 0 && (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                Recent Queries
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {queryHistory.map((q) => (
              <button
                key={q.id}
                onClick={() => {
                  setQuery(q.query_text);
                  setCurrentResponse({
                    id: q.id,
                    query: q.query_text,
                    generated_sql: q.generated_sql,
                    result_summary: q.result_summary,
                    result_data: q.result_data,
                    tokens_used: q.tokens_used,
                    latency_ms: q.latency_ms,
                  });
                }}
                className="w-full p-3 text-left bg-slate-50 dark:bg-slate-900/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{q.query_text}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{new Date(q.created_at).toLocaleString()}</span>
                  <span>{q.latency_ms}ms</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            AI Insights
          </h2>
          <Button variant="ghost" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {insights.length === 0 ? (
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardContent className="p-12 text-center">
              <Lightbulb className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mt-4">No insights yet</h3>
              <p className="text-muted-foreground mt-2">
                Click "Generate Insights" to analyze your data and get AI-powered recommendations
              </p>
              <Button onClick={generateInsights} disabled={generating} className="mt-6 rounded-xl">
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Generate Insights
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {insights.map((insight) => {
              const Icon = INSIGHT_ICONS[insight.insight_type] || Info;
              const styles = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;

              return (
                <Card 
                  key={insight.id} 
                  className={`border-0 shadow-lg overflow-hidden transition-all hover:shadow-xl ${styles.bg}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${styles.bg} border ${styles.border}`}>
                        <Icon className={`w-5 h-5 ${styles.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium uppercase tracking-wide ${styles.text}`}>
                                {insight.insight_type}
                              </span>
                              {insight.metric_change !== undefined && insight.metric_change !== null && (
                                <span className={`flex items-center gap-1 text-xs font-medium ${
                                  insight.metric_change >= 0 ? "text-emerald-600" : "text-red-600"
                                }`}>
                                  {insight.metric_change >= 0 ? (
                                    <TrendingUp className="w-3 h-3" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3" />
                                  )}
                                  {Math.abs(insight.metric_change).toFixed(1)}%
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold">{insight.title}</h3>
                            <p className="text-muted-foreground mt-1">{insight.description}</p>
                          </div>
                          <button
                            onClick={() => dismissInsight(insight.id)}
                            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>

                        {insight.metric_name && insight.metric_value !== undefined && (
                          <div className="mt-4 flex items-center gap-4">
                            <div className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                              <span className="text-xs text-muted-foreground block">{insight.metric_name}</span>
                              <span className="text-xl font-bold">
                                {typeof insight.metric_value === "number" 
                                  ? insight.metric_value.toLocaleString()
                                  : insight.metric_value
                                }
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                          <span>{new Date(insight.created_at).toLocaleString()}</span>
                          {!insight.is_read && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Predictive Analytics Preview */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-600 to-purple-700 text-white overflow-hidden">
        <CardContent className="p-6 relative">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Predictive Analytics</h3>
                <p className="text-indigo-200">Coming Soon</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              {[
                { title: "Churn Prediction", desc: "Identify users likely to leave", icon: TrendingDown },
                { title: "Conversion Forecast", desc: "Predict conversion rates", icon: TrendingUp },
                { title: "Revenue Forecast", desc: "Project future revenue", icon: BarChart3 },
              ].map((item) => (
                <div key={item.title} className="p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                  <item.icon className="w-8 h-8 mb-3 text-indigo-200" />
                  <h4 className="font-semibold">{item.title}</h4>
                  <p className="text-sm text-indigo-200 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
