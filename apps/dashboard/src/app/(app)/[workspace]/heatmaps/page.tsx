"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  MousePointer, Scroll, Move, Eye, Plus, Calendar, Search, Filter, 
  Loader2, RefreshCw, ChevronRight, Monitor, Smartphone, Tablet,
  TrendingUp, Target, Zap, Settings2, Download, ExternalLink, Code,
  Copy, Check, Shield, BookOpen, CheckCircle2, Info, X, ArrowRight
} from "lucide-react";
import { api, WorkspaceSettings } from "@/lib/api";

interface Heatmap {
  id: string;
  name: string;
  url: string;
  type: "click" | "scroll" | "movement";
  device: "desktop" | "mobile" | "tablet" | "all";
  views: number;
  clicks: number;
  created_at: string;
  last_updated: string;
}

// No mock data - heatmaps will be fetched from API when available
const MOCK_HEATMAPS: Heatmap[] = [];

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString([], { month: "short", day: "numeric" });
}

function HeatmapTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "click":
      return <MousePointer className="w-4 h-4" />;
    case "scroll":
      return <Scroll className="w-4 h-4" />;
    case "movement":
      return <Move className="w-4 h-4" />;
    default:
      return <Eye className="w-4 h-4" />;
  }
}

function DeviceIcon({ type }: { type: string }) {
  switch (type) {
    case "mobile":
      return <Smartphone className="w-4 h-4" />;
    case "tablet":
      return <Tablet className="w-4 h-4" />;
    case "all":
      return <Monitor className="w-4 h-4" />;
    default:
      return <Monitor className="w-4 h-4" />;
  }
}

function HeatmapViewer({ heatmap, onClose }: { heatmap: Heatmap; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (heatmap.type === "click") {
      const points = [
        { x: 400, y: 100, intensity: 0.9 },
        { x: 150, y: 300, intensity: 0.7 },
        { x: 650, y: 200, intensity: 0.8 },
        { x: 300, y: 450, intensity: 0.5 },
        { x: 500, y: 350, intensity: 0.6 },
        { x: 200, y: 150, intensity: 0.4 },
        { x: 600, y: 500, intensity: 0.3 },
      ];

      points.forEach((point) => {
        const gradient = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, 80 * point.intensity
        );
        gradient.addColorStop(0, `rgba(239, 68, 68, ${point.intensity})`);
        gradient.addColorStop(0.5, `rgba(251, 146, 60, ${point.intensity * 0.5})`);
        gradient.addColorStop(1, "rgba(250, 204, 21, 0)");

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(point.x, point.y, 80 * point.intensity, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (heatmap.type === "scroll") {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "rgba(34, 197, 94, 0.8)");
      gradient.addColorStop(0.3, "rgba(34, 197, 94, 0.6)");
      gradient.addColorStop(0.5, "rgba(251, 191, 36, 0.4)");
      gradient.addColorStop(0.7, "rgba(239, 68, 68, 0.3)");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0.1)");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.setLineDash([5, 5]);
      [0.25, 0.5, 0.75].forEach((pos) => {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height * pos);
        ctx.lineTo(canvas.width, canvas.height * pos);
        ctx.stroke();
      });
    } else {
      const paths = [
        [[100, 100], [200, 150], [350, 120], [400, 200], [450, 180]],
        [[50, 300], [150, 280], [250, 350], [400, 320], [550, 400]],
        [[200, 500], [300, 480], [400, 520], [500, 490], [600, 510]],
      ];

      paths.forEach((path, i) => {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(99, 102, 241, ${0.3 + i * 0.2})`;
        ctx.lineWidth = 2;
        path.forEach((point, j) => {
          if (j === 0) ctx.moveTo(point[0], point[1]);
          else ctx.lineTo(point[0], point[1]);
        });
        ctx.stroke();
      });
    }
  }, [heatmap]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl border-0 shadow-2xl">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HeatmapTypeIcon type={heatmap.type} />
                {heatmap.name}
              </CardTitle>
              <CardDescription>{heatmap.url} • {heatmap.views.toLocaleString()} views</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden">
            <canvas 
              ref={canvasRef} 
              className="w-full h-auto max-h-[500px] object-contain"
            />
          </div>
          <div className="flex items-center justify-center gap-8 mt-4 py-3 border-t">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span className="text-sm text-muted-foreground">High activity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-400" />
              <span className="text-sm text-muted-foreground">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-400" />
              <span className="text-sm text-muted-foreground">Low activity</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateHeatmapModal({ onClose, onSave }: { onClose: () => void; onSave: (heatmap: Heatmap) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"click" | "scroll" | "movement">("click");
  const [device, setDevice] = useState<"desktop" | "mobile" | "tablet" | "all">("all");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !url) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    
    const newHeatmap: Heatmap = {
      id: Date.now().toString(),
      name,
      url,
      type,
      device,
      views: 0,
      clicks: 0,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };
    
    onSave(newHeatmap);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MousePointer className="w-5 h-5 text-primary" />
              Create Heatmap
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Homepage Clicks"
              className="h-11 rounded-lg"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Page URL</Label>
            <Input 
              value={url} 
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/products"
              className="h-11 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>Heatmap Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "click", label: "Clicks", icon: MousePointer },
                { id: "scroll", label: "Scroll", icon: Scroll },
                { id: "movement", label: "Movement", icon: Move },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id as "click" | "scroll" | "movement")}
                  className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-colors ${
                    type === t.id 
                      ? "border-primary bg-primary/5 text-primary" 
                      : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                  }`}
                >
                  <t.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Device</Label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "all", label: "All" },
                { id: "desktop", label: "Desktop" },
                { id: "mobile", label: "Mobile" },
                { id: "tablet", label: "Tablet" },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDevice(d.id as "desktop" | "mobile" | "tablet" | "all")}
                  className={`p-2 border rounded-lg text-xs font-medium transition-colors ${
                    device === d.id 
                      ? "border-primary bg-primary/5 text-primary" 
                      : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={!name || !url || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SetupGuide({ onGoToSettings }: { onGoToSettings: () => void }) {
  const [copied, setCopied] = useState(false);
  
  const heatmapCode = `// Enable Heatmap tracking in your setup
analytics.enableHeatmaps({
  trackClicks: true,    // Track click positions
  trackScroll: true,    // Track scroll depth
  trackMovement: false, // Mouse movement (optional)
  sampleRate: 0.5       // Track 50% of sessions
});`;

  const copyCode = () => {
    navigator.clipboard.writeText(heatmapCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-600 text-white overflow-hidden">
        <CardContent className="p-8 relative">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <MousePointer className="w-12 h-12" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">Enable Heatmaps</h2>
              <p className="text-violet-100 max-w-xl">
                Visualize where users click, how far they scroll, and where they move their cursor. 
                Identify UX issues and optimize your page layouts based on real user behavior.
              </p>
            </div>
            <Button 
              onClick={onGoToSettings}
              className="bg-white text-violet-600 hover:bg-violet-50 rounded-xl h-12 px-6"
            >
              <Settings2 className="w-5 h-5 mr-2" />
              Enable in Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Three Types of Heatmaps */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            icon: MousePointer,
            title: "Click Heatmaps",
            description: "See exactly where users click. Identify which CTAs get attention and which are ignored.",
            color: "from-rose-500 to-pink-500",
            features: ["Button clicks", "Link interactions", "Image clicks", "Dead click detection"]
          },
          {
            icon: Scroll,
            title: "Scroll Heatmaps",
            description: "Understand how far users scroll. Know if your key content is being seen.",
            color: "from-emerald-500 to-teal-500",
            features: ["Fold analysis", "Content visibility", "Drop-off points", "Average scroll depth"]
          },
          {
            icon: Move,
            title: "Movement Heatmaps",
            description: "Track cursor movement patterns to understand reading behavior and attention.",
            color: "from-blue-500 to-indigo-500",
            features: ["Attention patterns", "Reading flow", "Hesitation areas", "Interest zones"]
          }
        ].map((type, i) => (
          <Card key={i} className="border-0 shadow-lg bg-white dark:bg-slate-800/50 overflow-hidden">
            <div className={`h-2 bg-gradient-to-r ${type.color}`} />
            <CardContent className="p-6">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center mb-4`}>
                <type.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-2">{type.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{type.description}</p>
              <ul className="space-y-1.5">
                {type.features.map((feature, j) => (
                  <li key={j} className="text-xs text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
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
              How Heatmaps Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { title: "Coordinate Tracking", desc: "Records X/Y positions of clicks relative to viewport and page" },
                { title: "Element Attribution", desc: "Associates clicks with specific DOM elements for detailed analysis" },
                { title: "Viewport Normalization", desc: "Normalizes coordinates across different screen sizes" },
                { title: "Aggregation", desc: "Combines data from multiple sessions to create density maps" },
                { title: "Visual Rendering", desc: "Uses canvas/WebGL to render heat overlay on page screenshots" }
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
              Add this after enabling Heatmaps in settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative group">
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-sm">
                <code>{heatmapCode}</code>
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
              The tracking script automatically handles heatmap data when enabled in settings.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Use Cases */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
              <BookOpen className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Similar to Amplitude Heatmaps</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Our heatmaps work similarly to industry-standard solutions. They capture user interactions 
                in real-time, aggregate the data by page and element, and visualize it as color-coded 
                overlays. Use heatmaps alongside session replay for complete user behavior understanding.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {[
                  { title: "A/B Test Validation", desc: "See which variant gets more engagement" },
                  { title: "CTA Optimization", desc: "Find the best button placement" },
                  { title: "Content Strategy", desc: "Know what content gets seen" },
                  { title: "Mobile UX", desc: "Compare behavior across devices" }
                ].map((useCase, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg">
                    <ArrowRight className="w-4 h-4 text-violet-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{useCase.title}</p>
                      <p className="text-xs text-muted-foreground">{useCase.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function HeatmapsPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params.workspace as string;

  const [heatmaps, setHeatmaps] = useState<Heatmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHeatmap, setSelectedHeatmap] = useState<Heatmap | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const checkSettings = async () => {
      try {
        const settings = await api.getWorkspaceSettings();
        setIsEnabled(settings.heatmap_enabled || false);
        
        if (settings.heatmap_enabled) {
          // TODO: Fetch heatmaps from API when endpoint is available
          setHeatmaps([]);
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

  const filteredHeatmaps = heatmaps.filter((heatmap) => {
    if (search && !heatmap.name.toLowerCase().includes(search.toLowerCase()) && 
        !heatmap.url.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (typeFilter && heatmap.type !== typeFilter) {
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
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                <MousePointer className="w-6 h-6 text-white" />
              </div>
              Heatmaps
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualize user clicks, scrolls, and cursor movement
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
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
              <MousePointer className="w-6 h-6 text-white" />
            </div>
            Heatmaps
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize user clicks, scrolls, and cursor movement
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
            className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Heatmap
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Heatmaps", value: heatmaps.length.toString(), icon: Eye, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-900/20" },
          { label: "Total Views", value: heatmaps.reduce((sum, h) => sum + h.views, 0).toLocaleString(), icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Clicks Tracked", value: heatmaps.reduce((sum, h) => sum + h.clicks, 0).toLocaleString(), icon: MousePointer, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-900/20" },
          { label: "Pages Analyzed", value: new Set(heatmaps.map(h => h.url)).size.toString(), icon: Target, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
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
            placeholder="Search heatmaps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: null, label: "All Types" },
            { id: "click", label: "Clicks", icon: MousePointer },
            { id: "scroll", label: "Scroll", icon: Scroll },
            { id: "movement", label: "Movement", icon: Move },
          ].map((type) => (
            <Button
              key={type.id || "all"}
              variant={typeFilter === type.id ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(type.id)}
              className="rounded-xl"
            >
              {type.icon && <type.icon className="w-4 h-4 mr-2" />}
              {type.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Heatmaps List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredHeatmaps.length === 0 ? (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardContent className="py-12 text-center">
            <MousePointer className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No heatmaps found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search ? "Try adjusting your search" : "Create your first heatmap to start tracking"}
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Heatmap
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHeatmaps.map((heatmap) => (
            <Card
              key={heatmap.id}
              className="border-0 shadow-lg bg-white dark:bg-slate-800/50 hover:shadow-xl transition-shadow cursor-pointer group"
              onClick={() => setSelectedHeatmap(heatmap)}
            >
              <CardContent className="p-4">
                <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 rounded-xl mb-4 flex items-center justify-center overflow-hidden relative">
                  <div className="absolute inset-0 opacity-30">
                    {heatmap.type === "click" && (
                      <>
                        <div className="absolute w-16 h-16 bg-red-500/50 rounded-full blur-xl top-4 left-8" />
                        <div className="absolute w-12 h-12 bg-orange-500/40 rounded-full blur-lg top-12 right-12" />
                        <div className="absolute w-8 h-8 bg-yellow-500/30 rounded-full blur-md bottom-8 left-16" />
                      </>
                    )}
                    {heatmap.type === "scroll" && (
                      <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-green-500/40 via-yellow-500/30 to-red-500/20" />
                    )}
                    {heatmap.type === "movement" && (
                      <svg className="absolute inset-0 w-full h-full">
                        <path d="M 20 40 Q 60 20 100 60 T 180 80" stroke="rgba(99,102,241,0.5)" fill="none" strokeWidth="2" />
                        <path d="M 40 80 Q 80 100 120 70 T 200 90" stroke="rgba(99,102,241,0.3)" fill="none" strokeWidth="2" />
                      </svg>
                    )}
                  </div>
                  <div className="relative text-center">
                    <HeatmapTypeIcon type={heatmap.type} />
                    <p className="text-xs text-muted-foreground mt-1">{heatmap.url}</p>
                  </div>
                </div>
                
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold group-hover:text-violet-600 transition-colors">
                      {heatmap.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {heatmap.views.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <DeviceIcon type={heatmap.device} />
                        {heatmap.device}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                    heatmap.type === "click" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                    heatmap.type === "scroll" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                    {heatmap.type}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground mt-2">
                  Updated {formatDate(heatmap.last_updated)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Viewer Modal */}
      {selectedHeatmap && (
        <HeatmapViewer heatmap={selectedHeatmap} onClose={() => setSelectedHeatmap(null)} />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateHeatmapModal 
          onClose={() => setShowCreateModal(false)} 
          onSave={(heatmap) => setHeatmaps(prev => [heatmap, ...prev])}
        />
      )}
    </div>
  );
}
