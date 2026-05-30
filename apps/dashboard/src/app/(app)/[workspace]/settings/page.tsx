"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, Palette, Globe, Key, Code, Smartphone, MousePointerClick, 
  ShoppingCart, Copy, Check, ChevronDown, ChevronRight,
  Database, BarChart3, Users, Activity, Apple, Play, Monitor, Zap,
  Brain, Shield, Eye, HardDrive, Cloud, Server, Sparkles, Lock,
  Mail, CreditCard, Phone, Clock, Trash2, Download, CheckCircle2,
  AlertCircle, Loader2, Video, MousePointer, ScrollText
} from "lucide-react";
import { api, WorkspaceSettings, Project } from "@/lib/api";

function CodeBlock({ code, language = "javascript" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-sm border border-slate-800">
        <code>{code}</code>
      </pre>
      <Button 
        size="sm" 
        variant="ghost" 
        className="absolute top-2 right-2 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copyCode}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
}

function DocSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false,
  badge
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 overflow-hidden">
      <CardHeader 
        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{title}</CardTitle>
              {badge && (
                <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
            </div>
          </div>
          {isOpen ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
        </div>
      </CardHeader>
      {isOpen && <CardContent className="pt-0 border-t border-slate-100 dark:border-slate-700">{children}</CardContent>}
    </Card>
  );
}

function SettingsToggle({ 
  label, 
  description, 
  checked, 
  onChange,
  icon: Icon
}: { 
  label: string; 
  description?: string; 
  checked: boolean; 
  onChange: (checked: boolean) => void;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div>
          <p className="font-medium text-sm">{label}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

const AI_PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "🤖", color: "from-green-500 to-emerald-600" },
  { id: "claude", name: "Anthropic Claude", icon: "🧠", color: "from-orange-500 to-amber-600" },
  { id: "gemini", name: "Google Gemini", icon: "✨", color: "from-blue-500 to-cyan-600" },
  { id: "deepseek", name: "DeepSeek", icon: "🔍", color: "from-purple-500 to-violet-600" },
  { id: "kimi", name: "Kimi (Moonshot)", icon: "🌙", color: "from-indigo-500 to-blue-600" },
];

const STORAGE_PROVIDERS = [
  { id: "server", name: "Server Storage", icon: Server, description: "Store data on your server" },
  { id: "s3", name: "Amazon S3", icon: Cloud, description: "AWS S3 bucket storage" },
  { id: "gcs", name: "Google Cloud", icon: Cloud, description: "Google Cloud Storage" },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const tabFromUrl = searchParams.get("tab");
  const validTabs = ["ai", "storage", "privacy", "features", "docs"];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "ai";
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [settings, setSettings] = useState<Partial<WorkspaceSettings>>({
    ai_enabled: false,
    ai_default_provider: "openai",
    storage_provider: "server",
    pii_masking_enabled: true,
    pii_mask_emails: true,
    pii_mask_phones: true,
    pii_mask_credit_cards: true,
    data_retention_days: 365,
    gdpr_enabled: true,
    replay_enabled: false,
    replay_sample_rate: 0.1,
    replay_mask_inputs: true,
    replay_mask_text: false,
    heatmap_enabled: false,
    heatmap_click: true,
    heatmap_scroll: true,
    heatmap_movement: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAI, setTestingAI] = useState<string | null>(null);
  const [testingStorage, setTestingStorage] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [collectorUrl, setCollectorUrl] = useState("");

  useEffect(() => {
    loadSettings();
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
      if (data.length > 0) {
        setSelectedProjectId(data[0].id);
        const snippet = await api.getProjectSnippet(data[0].id);
        const match = snippet.snippet.match(/src="([^"]+)\/t\.js/);
        if (match) {
          setCollectorUrl(match[1]);
        }
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const getCollectorDisplay = () => {
    if (collectorUrl && collectorUrl !== "http://localhost:8081") return collectorUrl;
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname.includes("dashboard")) {
        return `${window.location.protocol}//${hostname.replace("dashboard", "collector")}`;
      }
    }
    return "https://your-collector-url.com";
  };

  const getPublicKeyDisplay = () => selectedProject?.public_key || "YOUR_PUBLIC_KEY";

  const loadSettings = async () => {
    try {
      const data = await api.getWorkspaceSettings();
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.updateWorkspaceSettings(settings);
      setTestResult({ valid: true, message: "Settings saved successfully!" });
      setTimeout(() => setTestResult(null), 3000);
    } catch (error) {
      setTestResult({ valid: false, message: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const testAIConnection = async (provider: string) => {
    const keyMap: Record<string, keyof WorkspaceSettings> = {
      openai: "ai_openai_key",
      claude: "ai_claude_key",
      gemini: "ai_gemini_key",
      deepseek: "ai_deepseek_key",
      kimi: "ai_kimi_key",
    };
    
    const key = settings[keyMap[provider]];
    if (!key || typeof key !== "string") {
      setTestResult({ valid: false, message: "Please enter an API key first" });
      return;
    }

    setTestingAI(provider);
    try {
      const result = await api.testAIConnection(provider, key);
      setTestResult(result);
    } catch {
      setTestResult({ valid: false, message: "Connection test failed" });
    } finally {
      setTestingAI(null);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const testStorageConnection = async () => {
    setTestingStorage(true);
    try {
      const result = await api.testStorageConnection({
        provider: settings.storage_provider || "server",
        s3_bucket: settings.storage_s3_bucket,
        s3_region: settings.storage_s3_region,
        s3_access_key: settings.storage_s3_access_key,
        gcs_bucket: settings.storage_gcs_bucket,
        gcs_project_id: settings.storage_gcs_project_id,
        gcs_credentials: settings.storage_gcs_credentials,
      });
      setTestResult(result);
    } catch {
      setTestResult({ valid: false, message: "Connection test failed" });
    } finally {
      setTestingStorage(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const updateSetting = <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-2">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Settings & Documentation</h1>
          <p className="text-muted-foreground mt-1">
            Configure AI, storage, privacy, and learn how to integrate
          </p>
        </div>
        
        {testResult && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
            testResult.valid 
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" 
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          }`}>
            {testResult.valid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-sm font-medium">{testResult.message}</span>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex flex-wrap w-full h-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
          <TabsTrigger value="ai" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm py-2">
            <Brain className="w-4 h-4 mr-2" />
            AI
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm py-2">
            <HardDrive className="w-4 h-4 mr-2" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm py-2">
            <Shield className="w-4 h-4 mr-2" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="features" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm py-2">
            <Sparkles className="w-4 h-4 mr-2" />
            Features
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm py-2">
            <Code className="w-4 h-4 mr-2" />
            Docs
          </TabsTrigger>
        </TabsList>

        {/* AI Settings Tab */}
        <TabsContent value="ai" className="space-y-6">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white overflow-hidden">
            <CardContent className="p-6 relative">
              <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">AI-Powered Analytics</h3>
                    <p className="text-purple-100">Automated insights, anomaly detection, and natural language queries</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                  <div>
                    <p className="font-medium">Enable AI Features</p>
                    <p className="text-sm text-purple-200">Use your own API keys for AI-powered insights</p>
                  </div>
                  <button
                    onClick={() => updateSetting("ai_enabled", !settings.ai_enabled)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      settings.ai_enabled ? "bg-white" : "bg-white/30"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full shadow transition-all ${
                        settings.ai_enabled 
                          ? "left-8 bg-purple-600" 
                          : "left-1 bg-white"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {settings.ai_enabled && (
            <>
              <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary" />
                    AI Provider API Keys
                  </CardTitle>
                  <CardDescription>
                    Add your API keys for AI providers. Keys are encrypted and stored securely.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {AI_PROVIDERS.map((provider) => {
                    const keyField = `ai_${provider.id}_key` as keyof WorkspaceSettings;
                    const keyValue = settings[keyField] as string || "";
                    
                    return (
                      <div key={provider.id} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center text-xl`}>
                            {provider.icon}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{provider.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {keyValue && keyValue.includes("••••") ? "Key configured" : "No key set"}
                            </p>
                          </div>
                          {settings.ai_default_provider === provider.id && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder={`Enter ${provider.name} API key`}
                            value={keyValue}
                            onChange={(e) => updateSetting(keyField, e.target.value as never)}
                            className="h-10 rounded-lg font-mono text-sm flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 px-4"
                            onClick={() => testAIConnection(provider.id)}
                            disabled={testingAI === provider.id || !keyValue}
                          >
                            {testingAI === provider.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Test"
                            )}
                          </Button>
                          <Button
                            variant={settings.ai_default_provider === provider.id ? "default" : "outline"}
                            size="sm"
                            className="h-10"
                            onClick={() => updateSetting("ai_default_provider", provider.id)}
                          >
                            {settings.ai_default_provider === provider.id ? "Default" : "Set Default"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    AI Capabilities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { icon: "🔍", title: "Anomaly Detection", desc: "Automatic alerts when metrics deviate from normal" },
                      { icon: "💡", title: "Auto Insights", desc: "AI-generated recommendations based on your data" },
                      { icon: "💬", title: "Natural Language Queries", desc: "Ask questions in plain English" },
                      { icon: "📈", title: "Predictive Analytics", desc: "Churn prediction & conversion forecasting" },
                    ].map((item) => (
                      <div key={item.title} className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving} className="rounded-xl px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Save AI Settings
            </Button>
          </div>
        </TabsContent>

        {/* Storage Settings Tab */}
        <TabsContent value="storage" className="space-y-6">
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-primary" />
                Storage Provider
              </CardTitle>
              <CardDescription>
                Choose where to store session recordings and heatmap data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                {STORAGE_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => updateSetting("storage_provider", provider.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      settings.storage_provider === provider.id
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                    }`}
                  >
                    <provider.icon className={`w-8 h-8 mb-3 ${
                      settings.storage_provider === provider.id ? "text-primary" : "text-muted-foreground"
                    }`} />
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
                  </button>
                ))}
              </div>

              {settings.storage_provider === "s3" && (
                <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    Amazon S3 Configuration
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bucket Name</Label>
                      <Input
                        placeholder="my-analytics-bucket"
                        value={settings.storage_s3_bucket || ""}
                        onChange={(e) => updateSetting("storage_s3_bucket", e.target.value)}
                        className="h-10 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Region</Label>
                      <Input
                        placeholder="us-east-1"
                        value={settings.storage_s3_region || ""}
                        onChange={(e) => updateSetting("storage_s3_region", e.target.value)}
                        className="h-10 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Access Key ID</Label>
                      <Input
                        type="password"
                        placeholder="AKIA..."
                        value={settings.storage_s3_access_key || ""}
                        onChange={(e) => updateSetting("storage_s3_access_key", e.target.value)}
                        className="h-10 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Secret Access Key</Label>
                      <Input
                        type="password"
                        placeholder="Secret key"
                        onChange={(e) => updateSetting("storage_s3_access_key", e.target.value)}
                        className="h-10 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {settings.storage_provider === "gcs" && (
                <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    Google Cloud Storage Configuration
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bucket Name</Label>
                      <Input
                        placeholder="my-gcs-bucket"
                        value={settings.storage_gcs_bucket || ""}
                        onChange={(e) => updateSetting("storage_gcs_bucket", e.target.value)}
                        className="h-10 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Project ID</Label>
                      <Input
                        placeholder="my-project-123"
                        value={settings.storage_gcs_project_id || ""}
                        onChange={(e) => updateSetting("storage_gcs_project_id", e.target.value)}
                        className="h-10 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Service Account JSON</Label>
                    <textarea
                      placeholder='{"type": "service_account", ...}'
                      value={settings.storage_gcs_credentials || ""}
                      onChange={(e) => updateSetting("storage_gcs_credentials", e.target.value)}
                      className="w-full h-32 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              <Button 
                variant="outline" 
                onClick={testStorageConnection}
                disabled={testingStorage}
                className="mt-4"
              >
                {testingStorage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Test Connection
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving} className="rounded-xl px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Save Storage Settings
            </Button>
          </div>
        </TabsContent>

        {/* Privacy & Data Governance Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white overflow-hidden">
            <CardContent className="p-6 relative">
              <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
              <div className="relative flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Data Privacy & Governance</h3>
                  <p className="text-emerald-100">GDPR compliance, PII masking, and data retention policies</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                PII Masking
              </CardTitle>
              <CardDescription>
                Automatically detect and mask personally identifiable information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SettingsToggle
                label="Enable PII Masking"
                description="Automatically mask sensitive data in collected events"
                checked={settings.pii_masking_enabled || false}
                onChange={(v) => updateSetting("pii_masking_enabled", v)}
                icon={Shield}
              />
              
              {settings.pii_masking_enabled && (
                <div className="ml-4 space-y-3 border-l-2 border-slate-200 dark:border-slate-700 pl-4">
                  <SettingsToggle
                    label="Mask Email Addresses"
                    description="Replace emails with hashed values"
                    checked={settings.pii_mask_emails || false}
                    onChange={(v) => updateSetting("pii_mask_emails", v)}
                    icon={Mail}
                  />
                  <SettingsToggle
                    label="Mask Phone Numbers"
                    description="Detect and mask phone numbers"
                    checked={settings.pii_mask_phones || false}
                    onChange={(v) => updateSetting("pii_mask_phones", v)}
                    icon={Phone}
                  />
                  <SettingsToggle
                    label="Mask Credit Card Numbers"
                    description="Auto-detect and mask card numbers"
                    checked={settings.pii_mask_credit_cards || false}
                    onChange={(v) => updateSetting("pii_mask_credit_cards", v)}
                    icon={CreditCard}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Data Retention
              </CardTitle>
              <CardDescription>
                Configure how long data is stored before automatic deletion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Retention Period</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={30}
                    max={3650}
                    value={settings.data_retention_days || 365}
                    onChange={(e) => updateSetting("data_retention_days", parseInt(e.target.value) || 365)}
                    className="h-10 rounded-lg w-32"
                  />
                  <span className="flex items-center text-muted-foreground">days</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Data older than this will be automatically deleted. Minimum 30 days.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-2 mt-4">
                {[
                  { label: "90 Days", value: 90 },
                  { label: "1 Year", value: 365 },
                  { label: "2 Years", value: 730 },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateSetting("data_retention_days", option.value)}
                    className={`p-3 rounded-lg border transition-colors ${
                      settings.data_retention_days === option.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                GDPR Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingsToggle
                label="Enable GDPR Features"
                description="Data deletion requests, export, and consent management"
                checked={settings.gdpr_enabled || false}
                onChange={(v) => updateSetting("gdpr_enabled", v)}
                icon={Shield}
              />

              {settings.gdpr_enabled && (
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Trash2 className="w-5 h-5 text-red-500" />
                      <span className="font-medium">Data Deletion</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Process deletion requests for user data
                    </p>
                    <Button variant="outline" size="sm" className="w-full">
                      Request Deletion
                    </Button>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Download className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">Data Export</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Export all data for a specific user
                    </p>
                    <Button variant="outline" size="sm" className="w-full">
                      Export Data
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving} className="rounded-xl px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Save Privacy Settings
            </Button>
          </div>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-6">
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Session Replay
              </CardTitle>
              <CardDescription>
                Record user sessions to see exactly how they interact with your site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingsToggle
                label="Enable Session Replay"
                description="Record and playback user sessions"
                checked={settings.replay_enabled || false}
                onChange={(v) => updateSetting("replay_enabled", v)}
                icon={Video}
              />

              {settings.replay_enabled && (
                <div className="space-y-4 mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <div className="space-y-2">
                    <Label>Sample Rate</Label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={(settings.replay_sample_rate || 0.1) * 100}
                        onChange={(e) => updateSetting("replay_sample_rate", parseInt(e.target.value) / 100)}
                        className="flex-1"
                      />
                      <span className="w-16 text-right font-medium">
                        {Math.round((settings.replay_sample_rate || 0.1) * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Percentage of sessions to record
                    </p>
                  </div>

                  <SettingsToggle
                    label="Mask Input Fields"
                    description="Hide text typed in inputs and textareas"
                    checked={settings.replay_mask_inputs || false}
                    onChange={(v) => updateSetting("replay_mask_inputs", v)}
                  />
                  <SettingsToggle
                    label="Mask All Text"
                    description="Replace all text content with placeholder"
                    checked={settings.replay_mask_text || false}
                    onChange={(v) => updateSetting("replay_mask_text", v)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MousePointer className="w-5 h-5 text-primary" />
                Heatmaps
              </CardTitle>
              <CardDescription>
                Visualize where users click, scroll, and move their cursor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingsToggle
                label="Enable Heatmaps"
                description="Track mouse interactions for heatmap visualization"
                checked={settings.heatmap_enabled || false}
                onChange={(v) => updateSetting("heatmap_enabled", v)}
                icon={MousePointer}
              />

              {settings.heatmap_enabled && (
                <div className="space-y-3 mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <SettingsToggle
                    label="Click Heatmaps"
                    description="Track where users click"
                    checked={settings.heatmap_click || false}
                    onChange={(v) => updateSetting("heatmap_click", v)}
                    icon={MousePointerClick}
                  />
                  <SettingsToggle
                    label="Scroll Heatmaps"
                    description="Track how far users scroll"
                    checked={settings.heatmap_scroll || false}
                    onChange={(v) => updateSetting("heatmap_scroll", v)}
                    icon={ScrollText}
                  />
                  <SettingsToggle
                    label="Mouse Movement"
                    description="Track cursor movement (higher data volume)"
                    checked={settings.heatmap_movement || false}
                    onChange={(v) => updateSetting("heatmap_movement", v)}
                    icon={Eye}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving} className="rounded-xl px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Save Feature Settings
            </Button>
          </div>
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="docs" className="space-y-4">
          
          <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold mb-2">Quick Start Guide</h3>
                  <p className="text-blue-100">One SDK works for both Web and Mobile apps. Add a single tracking code and start collecting data instantly.</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                    <Monitor className="w-5 h-5" />
                    <span className="font-medium">Web</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                    <Smartphone className="w-5 h-5" />
                    <span className="font-medium">Mobile</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Selector */}
          {projects.length > 0 && (
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Globe className="w-4 h-4" />
                    Project:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => setSelectedProjectId(project.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedProjectId === project.id
                            ? "bg-primary text-white shadow-md"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                        }`}
                      >
                        {project.name}
                        {project.domain && (
                          <span className="ml-1.5 text-xs opacity-70">({project.domain})</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedProject && (
                  <div className="mt-3 flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <code className="text-sm font-mono flex-1">{selectedProject.public_key}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedProject.public_key);
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <DocSection title="Website Integration" icon={Code} defaultOpen={true}>
            <div className="space-y-6 pt-4">
              <p className="text-muted-foreground">
                Add this single script tag to your website to start tracking automatically.
              </p>
              
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">1</span>
                  Add Script Tag
                </h4>
                <CodeBlock code={`<script src="${getCollectorDisplay()}/t.js?k=${getPublicKeyDisplay()}" async></script>`} />
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">2</span>
                  Automatic Tracking
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { icon: "📄", title: "Page Views", desc: "All page loads & SPA navigation" },
                    { icon: "🔗", title: "URL Parameters", desc: "UTM and custom parameters" },
                    { icon: "📊", title: "Traffic Sources", desc: "Google, Facebook, AI platforms" },
                    { icon: "⏱️", title: "Session Duration", desc: "Time on page & bounce rate" },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                      <span className="text-xl">{item.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DocSection>

          <DocSection title="iOS App Integration" icon={Apple} badge="Swift">
            <div className="space-y-6 pt-4">
              <div className="space-y-3">
                <h4 className="font-semibold">Initialize & Track</h4>
                <CodeBlock code={`import Analytics

// In AppDelegate
Analytics.configure(publicKey: "${getPublicKeyDisplay()}")

// Track events
Analytics.track("screen_view", properties: [
    "screen_name": "HomeScreen"
])

// Track purchase
Analytics.track("purchase", properties: [
    "order_id": "ORD-123",
    "revenue": 99.99
])`} />
              </div>
            </div>
          </DocSection>

          <DocSection title="Android App Integration" icon={Play} badge="Kotlin">
            <div className="space-y-6 pt-4">
              <div className="space-y-3">
                <h4 className="font-semibold">Initialize & Track</h4>
                <CodeBlock code={`import com.analytics.Analytics

// In Application class
Analytics.configure(this, "${getPublicKeyDisplay()}")

// Track events
Analytics.track("screen_view", mapOf(
    "screen_name" to "HomeActivity"
))

// Track purchase
Analytics.track("purchase", mapOf(
    "order_id" to "ORD-123",
    "revenue" to 99.99
))`} />
              </div>
            </div>
          </DocSection>

          <DocSection title="Button & Click Tracking" icon={MousePointerClick}>
            <div className="space-y-6 pt-4">
              <div className="space-y-3">
                <h4 className="font-semibold">Using data-track Attribute</h4>
                <CodeBlock code={`<!-- Auto-track any clickable element -->
<button data-track="cta_click">Get Started</button>

<!-- With custom properties -->
<button 
  data-track="feature_interest" 
  data-track-props='{"feature": "ai-reports"}'
>
  Learn More
</button>`} />
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">Programmatic Tracking</h4>
                <CodeBlock code={`window.analytics.track('button_clicked', {
  button_name: 'signup',
  page: '/home'
});`} />
              </div>
            </div>
          </DocSection>

          <DocSection title="E-commerce Tracking" icon={ShoppingCart}>
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <h4 className="font-semibold">Add to Cart & Purchase</h4>
                <CodeBlock code={`// Add to cart
analytics.ecommerce.addToCart({
  product_id: 'SKU-123',
  name: 'Premium Widget',
  price: 99.99,
  quantity: 1
});

// Purchase
analytics.ecommerce.purchase({
  order_id: 'ORD-789',
  revenue: 249.97,
  currency: 'USD',
  products: [
    { product_id: 'SKU-123', price: 99.99, quantity: 2 }
  ]
});`} />
              </div>
            </div>
          </DocSection>

          <DocSection title="WordPress Integration" icon={Globe} badge="Popular">
            <div className="space-y-6 pt-4">
              <p className="text-muted-foreground">
                Integrate analytics with your WordPress site in under 30 seconds. Works with single sites, multisite, and WooCommerce.
              </p>

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">1</span>
                  Method 1: functions.php (Quickest)
                </h4>
                <p className="text-sm text-muted-foreground">Go to WordPress Admin → Appearance → Theme File Editor → Select functions.php → Add this at the bottom:</p>
                <CodeBlock code={`add_action('wp_head', function() {
    echo '<script src="${getCollectorDisplay()}/t.js?k=${getPublicKeyDisplay()}" async></script>';
});`} language="php" />
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">2</span>
                  Method 2: WordPress Plugin (Recommended)
                </h4>
                <p className="text-sm text-muted-foreground">Create a file wp-content/plugins/analytics-tracker.php:</p>
                <CodeBlock code={`<?php
/**
 * Plugin Name: Analytics Tracker
 * Description: Integrates custom analytics tracking
 * Version: 1.0
 */
defined('ABSPATH') || exit;

class Analytics_Tracker {
    private $public_key;
    private $collector_url;
    
    public function __construct() {
        $this->public_key = get_option('analytics_public_key', '');
        $this->collector_url = get_option('analytics_collector_url', '');
        
        add_action('wp_head', [$this, 'add_tracking_script']);
        add_action('admin_menu', [$this, 'add_settings_page']);
        add_action('admin_init', [$this, 'register_settings']);
    }
    
    public function add_tracking_script() {
        if (empty($this->public_key) || empty($this->collector_url)) return;
        
        printf(
            '<script src="%s/t.js?k=%s" async></script>',
            esc_url($this->collector_url),
            esc_attr($this->public_key)
        );
    }
    
    public function add_settings_page() {
        add_options_page('Analytics', 'Analytics', 'manage_options', 
            'analytics-tracker', [$this, 'render_settings_page']);
    }
    
    public function register_settings() {
        register_setting('analytics_tracker', 'analytics_public_key');
        register_setting('analytics_tracker', 'analytics_collector_url');
    }
    
    public function render_settings_page() {
        ?>
        <div class="wrap">
            <h1>Analytics Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields('analytics_tracker'); ?>
                <table class="form-table">
                    <tr>
                        <th>Collector URL</th>
                        <td><input type="url" name="analytics_collector_url" 
                            value="<?php echo esc_attr(get_option('analytics_collector_url')); ?>" 
                            class="regular-text"></td>
                    </tr>
                    <tr>
                        <th>Public Key</th>
                        <td><input type="text" name="analytics_public_key" 
                            value="<?php echo esc_attr(get_option('analytics_public_key')); ?>" 
                            class="regular-text"></td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
}
new Analytics_Tracker();`} language="php" />
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">3</span>
                  WooCommerce E-commerce Tracking
                </h4>
                <p className="text-sm text-muted-foreground">Add this to functions.php to track purchases:</p>
                <CodeBlock code={`// Track WooCommerce Purchase
add_action('woocommerce_thankyou', function($order_id) {
    $order = wc_get_order($order_id);
    if (!$order) return;
    
    $items = [];
    foreach ($order->get_items() as $item) {
        $items[] = [
            'id' => $item->get_product_id(),
            'name' => $item->get_name(),
            'quantity' => $item->get_quantity(),
            'price' => $item->get_total()
        ];
    }
    ?>
    <script>
        if (window.analytics) {
            analytics.ecommerce.purchase({
                order_id: '<?php echo esc_js($order_id); ?>',
                revenue: <?php echo (float)$order->get_total(); ?>,
                currency: '<?php echo esc_js($order->get_currency()); ?>',
                items: <?php echo json_encode($items); ?>
            });
        }
    </script>
    <?php
});`} language="php" />
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">4</span>
                  Track Logged-In WordPress Users
                </h4>
                <CodeBlock code={`add_action('wp_head', function() {
    if (is_user_logged_in()) {
        $user = wp_get_current_user();
        echo '<script>window.analyticsUser = ' . json_encode([
            'id' => (string)$user->ID,
            'email' => $user->user_email,
            'name' => $user->display_name
        ]) . ';</script>';
    }
}, 1); // Priority 1 = runs before tracking script`} language="php" />
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">WordPress Multisite</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Subdirectory Setup:</strong> One single tag tracks all sites automatically since they share the same domain.<br/>
                  <strong>Subdomain Setup:</strong> Use the same key for all subdomains, or create separate projects per subdomain.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">5</span>
                  Must-Use Plugin (Best for Multisite)
                </h4>
                <p className="text-sm text-muted-foreground">Create the file <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">wp-content/mu-plugins/analytics-tracking.php</code> via SFTP:</p>
                <CodeBlock code={`<?php
/**
 * Plugin Name: Analytics Tracking
 * Description: Adds analytics tracking code to all pages
 */
add_action('wp_head', function() {
    echo '<script src="${getCollectorDisplay()}/t.js?k=${getPublicKeyDisplay()}" async></script>';
});`} language="php" />
                <p className="text-xs text-muted-foreground">
                  Must-use plugins auto-activate on all sites in your Multisite network. No activation needed.
                </p>
              </div>
            </div>
          </DocSection>

          <DocSection title="Reporting API" icon={Database}>
            <div className="space-y-6 pt-4">
              <div className="space-y-3">
                <h4 className="font-semibold">Authentication</h4>
                <CodeBlock code={`curl -H "Authorization: Bearer YOUR_API_TOKEN" \\
     -H "X-Workspace-ID: YOUR_WORKSPACE_ID" \\
     ${getCollectorDisplay().replace("collector", "api")}/v1/reports/summary`} />
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">GET /v1/reports/summary</h4>
                <CodeBlock code={`GET /v1/reports/summary?project_id=xxx&start=2024-01-01&end=2024-01-31

Response:
{
  "total_events": 45230,
  "bounce_rate": 42.3,
  "avg_session_duration_seconds": 185.4,
  "top_sources": [
    { "source": "Google", "category": "search", "count": 12400 }
  ]
}`} />
              </div>
            </div>
          </DocSection>

          <DocSection title="Traffic Source Categories" icon={Activity}>
            <div className="space-y-4 pt-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Search", color: "bg-yellow-500", examples: "Google, Bing, DuckDuckGo" },
                  { label: "Social", color: "bg-blue-500", examples: "Facebook, Instagram, Twitter" },
                  { label: "AI", color: "bg-purple-500", examples: "ChatGPT, Claude, Perplexity" },
                  { label: "Video", color: "bg-red-500", examples: "YouTube, TikTok, Vimeo" },
                  { label: "Messaging", color: "bg-green-500", examples: "WhatsApp, Telegram, Discord" },
                  { label: "Email", color: "bg-orange-500", examples: "Gmail, Outlook" },
                  { label: "Developer", color: "bg-cyan-500", examples: "GitHub, Stack Overflow" },
                  { label: "Direct", color: "bg-slate-500", examples: "Typed URL, Bookmarks" },
                ].map((source) => (
                  <div key={source.label} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full ${source.color}`} />
                      <span className="font-medium text-sm">{source.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{source.examples}</p>
                  </div>
                ))}
              </div>
            </div>
          </DocSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
