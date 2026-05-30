"use client";

import { useEffect, useState } from "react";
import { api, Banner } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { 
  Plus, Megaphone, Play, Pause, Archive, Eye, Loader2, Search,
  X, Edit, Trash2, Copy, RefreshCw, MoreVertical, Settings2,
  Monitor, Smartphone, Target, Clock, Users, BarChart3
} from "lucide-react";

const statusColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  active: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
  paused: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
  archived: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" },
};

const displayTypes = [
  { id: "modal", name: "Modal", icon: Monitor },
  { id: "banner", name: "Banner", icon: Megaphone },
  { id: "slideout", name: "Slide-out", icon: Smartphone },
  { id: "tooltip", name: "Tooltip", icon: Target },
];

function EditBannerModal({ banner, onClose, onSave }: { banner: Banner; onClose: () => void; onSave: (banner: Banner) => void }) {
  const [name, setName] = useState(banner.name);
  const [frequencyCap, setFrequencyCap] = useState(banner.frequency_cap_per_user);
  const [frequencyDays, setFrequencyDays] = useState(banner.frequency_cap_days);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    onSave({ 
      ...banner, 
      name, 
      frequency_cap_per_user: frequencyCap, 
      frequency_cap_days: frequencyDays 
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              Edit Banner
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Banner Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequency Cap</Label>
              <Input 
                type="number"
                value={frequencyCap} 
                onChange={(e) => setFrequencyCap(Number(e.target.value))}
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Per Days</Label>
              <Input 
                type="number"
                value={frequencyDays} 
                onChange={(e) => setFrequencyDays(Number(e.target.value))}
                className="h-11 rounded-lg"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewBannerModal({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-0 shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Banner Preview: {banner.name}</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-8 min-h-[300px] flex items-center justify-center">
            {banner.config?.type === "modal" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md text-center">
                <Megaphone className="w-12 h-12 mx-auto text-pink-500 mb-4" />
                <h3 className="text-xl font-bold mb-2">{banner.name}</h3>
                <p className="text-muted-foreground mb-6">This is a preview of your banner content. Customize your message and CTA.</p>
                <Button className="rounded-xl">Call to Action</Button>
              </div>
            )}
            {banner.config?.type === "banner" && (
              <div className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white p-4 rounded-xl flex items-center justify-between">
                <span className="font-medium">{banner.name} - Your banner message here!</span>
                <Button variant="secondary" size="sm">Learn More</Button>
              </div>
            )}
            {(!banner.config?.type || banner.config?.type === "slideout" || banner.config?.type === "tooltip") && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-sm">
                <h4 className="font-semibold mb-2">{banner.name}</h4>
                <p className="text-sm text-muted-foreground">Preview for {String(banner.config?.type || "default")} display type</p>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            This is a preview. Actual appearance may vary based on your website styles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("modal");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    setLoading(true);
    try {
      const projectId = localStorage.getItem("selected_project");
      const data = await api.getBanners(projectId || undefined);
      setBanners(data);
    } catch (err) {
      console.error("Failed to load banners:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const projectId = localStorage.getItem("selected_project");
      if (!projectId) return;

      await api.createBanner({
        project_id: projectId,
        name: newName,
        config: { type: newType, position: "center" },
        targeting: {},
        frequency_cap_per_user: 1,
        frequency_cap_days: 7,
      });
      setShowCreate(false);
      setNewName("");
      setNewType("modal");
      loadBanners();
    } catch (err) {
      console.error("Failed to create banner:", err);
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.updateBanner(id, { status } as any);
      loadBanners();
    } catch (err) {
      console.error("Failed to update banner:", err);
    }
    setActiveMenu(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/banners/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            "X-Workspace-ID": localStorage.getItem("workspace_id") || "",
          },
        }
      );
      loadBanners();
    } catch (err) {
      console.error("Failed to delete banner:", err);
    }
    setActiveMenu(null);
  };

  const filteredBanners = banners.filter((banner) => {
    if (search && !banner.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (statusFilter && banner.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const stats = {
    total: banners.length,
    active: banners.filter(b => b.status === "active").length,
    paused: banners.filter(b => b.status === "paused").length,
    draft: banners.filter(b => b.status === "draft").length,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl">
              <Megaphone className="w-6 h-6 text-white" />
            </div>
            Banners & Pop-ups
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage pop-up campaigns to engage your users
          </p>
        </div>
        <Button 
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Banner
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Banners", value: stats.total.toString(), icon: Megaphone, color: "text-pink-500" },
          { label: "Active", value: stats.active.toString(), icon: Play, color: "text-emerald-500" },
          { label: "Paused", value: stats.paused.toString(), icon: Pause, color: "text-amber-500" },
          { label: "Drafts", value: stats.draft.toString(), icon: Edit, color: "text-slate-500" },
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
                placeholder="Search banners..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === null ? "default" : "outline"}
                onClick={() => setStatusFilter(null)}
                className="rounded-lg"
              >
                All
              </Button>
              <Button
                variant={statusFilter === "active" ? "default" : "outline"}
                onClick={() => setStatusFilter("active")}
                className="rounded-lg"
              >
                Active
              </Button>
              <Button
                variant={statusFilter === "paused" ? "default" : "outline"}
                onClick={() => setStatusFilter("paused")}
                className="rounded-lg"
              >
                Paused
              </Button>
              <Button
                variant={statusFilter === "draft" ? "default" : "outline"}
                onClick={() => setStatusFilter("draft")}
                className="rounded-lg"
              >
                Draft
              </Button>
              <Button variant="outline" onClick={loadBanners} className="rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-0 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-primary" />
                    Create New Banner
                  </CardTitle>
                  <CardDescription>
                    Set up a new pop-up or banner campaign
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Banner Name</Label>
                  <Input
                    id="name"
                    placeholder="Summer Sale Popup"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-11 rounded-lg"
                    required
                  />
                </div>
                
                <div className="space-y-3">
                  <Label>Display Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {displayTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewType(type.id)}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3",
                          newType === type.id
                            ? "border-primary bg-primary/5"
                            : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                        )}
                      >
                        <type.icon className="w-5 h-5 text-muted-foreground" />
                        <span className="font-medium">{type.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating} className="flex-1">
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Banner
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Banner List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredBanners.length === 0 ? (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto bg-pink-100 dark:bg-pink-900/30 rounded-2xl flex items-center justify-center mb-4">
              <Megaphone className="w-8 h-8 text-pink-600" />
            </div>
            <h3 className="text-lg font-semibold">No banners yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Create pop-ups and banners to engage your users
            </p>
            <Button onClick={() => setShowCreate(true)} className="mt-6 rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Create Banner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBanners.map((banner) => {
            const statusStyle = statusColors[banner.status];
            return (
              <Card key={banner.id} className="border-0 shadow-lg bg-white dark:bg-slate-800/50 hover:shadow-xl transition-shadow">
                <CardContent className="p-0">
                  {/* Preview Area */}
                  <div className="h-32 bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/20 dark:to-rose-900/20 relative overflow-hidden rounded-t-xl">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-16 bg-white dark:bg-slate-800 rounded-lg shadow-lg flex items-center justify-center">
                        <Megaphone className="w-6 h-6 text-pink-500" />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{banner.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {formatDate(banner.created_at)}
                        </p>
                      </div>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg"
                          onClick={() => setActiveMenu(activeMenu === banner.id ? null : banner.id)}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                        {activeMenu === banner.id && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                            <button
                              onClick={() => {
                                setSelectedBanner(banner);
                                setShowEditModal(true);
                                setActiveMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBanner(banner);
                                setShowPreviewModal(true);
                                setActiveMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              Preview
                            </button>
                            <button
                              onClick={() => handleDelete(banner.id)}
                              className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm mb-4">
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium capitalize", statusStyle.bg, statusStyle.text)}>
                        {banner.status}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {banner.frequency_cap_per_user}x / {banner.frequency_cap_days} days
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {banner.status === "draft" && (
                        <Button
                          size="sm"
                          className="flex-1 rounded-lg"
                          onClick={() => updateStatus(banner.id, "active")}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Activate
                        </Button>
                      )}
                      {banner.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 rounded-lg"
                          onClick={() => updateStatus(banner.id, "paused")}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pause
                        </Button>
                      )}
                      {banner.status === "paused" && (
                        <>
                          <Button
                            size="sm"
                            className="flex-1 rounded-lg"
                            onClick={() => updateStatus(banner.id, "active")}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Resume
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            onClick={() => updateStatus(banner.id, "archived")}
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" className="rounded-lg">
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedBanner && (
        <EditBannerModal 
          banner={selectedBanner} 
          onClose={() => {
            setShowEditModal(false);
            setSelectedBanner(null);
          }}
          onSave={(updated) => {
            setBanners(prev => prev.map(b => b.id === updated.id ? updated : b));
          }}
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedBanner && (
        <PreviewBannerModal 
          banner={selectedBanner} 
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedBanner(null);
          }} 
        />
      )}
    </div>
  );
}
