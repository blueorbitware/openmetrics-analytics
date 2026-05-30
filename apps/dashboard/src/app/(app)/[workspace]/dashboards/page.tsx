"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api, Dashboard } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { 
  Plus, LayoutDashboard, Star, Loader2, Search, MoreVertical, 
  Edit, Trash2, Copy, Eye, RefreshCw, X, Grid3X3, List
} from "lucide-react";

function ViewDashboardModal({ dashboard, onClose }: { dashboard: Dashboard; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl border-0 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {dashboard.name}
                {dashboard.is_default && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
              </CardTitle>
              <CardDescription>{dashboard.description || "No description"}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 flex-1 overflow-y-auto">
          <div className="h-64 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center">
            <div className="text-center">
              <LayoutDashboard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Dashboard widgets will appear here</p>
              <p className="text-sm text-muted-foreground mt-2">Drag and drop widgets to customize your view</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            {["Events Chart", "Users Over Time", "Top Pages"].map((widget) => (
              <div key={widget} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <h4 className="font-medium text-sm mb-2">{widget}</h4>
                <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EditDashboardModal({ dashboard, onClose, onSave }: { dashboard: Dashboard; onClose: () => void; onSave: (dashboard: Dashboard) => void }) {
  const [name, setName] = useState(dashboard.name);
  const [description, setDescription] = useState(dashboard.description || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    onSave({ ...dashboard, name, description });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Edit Dashboard</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Dashboard Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="h-11 rounded-lg"
            />
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

export default function DashboardsPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params.workspace as string;

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    setLoading(true);
    try {
      const projectId = localStorage.getItem("selected_project");
      const data = await api.getDashboards(projectId || undefined);
      setDashboards(data);
    } catch (err) {
      console.error("Failed to load dashboards:", err);
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

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/dashboards`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            "X-Workspace-ID": localStorage.getItem("workspace_id") || "",
          },
          body: JSON.stringify({
            project_id: projectId,
            name: newName,
            description: newDescription,
          }),
        }
      );

      if (response.ok) {
        setShowCreate(false);
        setNewName("");
        setNewDescription("");
        loadDashboards();
      }
    } catch (err) {
      console.error("Failed to create dashboard:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this dashboard?")) return;
    
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/dashboards/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            "X-Workspace-ID": localStorage.getItem("workspace_id") || "",
          },
        }
      );
      loadDashboards();
    } catch (err) {
      console.error("Failed to delete dashboard:", err);
    }
    setActiveMenu(null);
  };

  const handleDuplicate = (dashboard: Dashboard) => {
    setNewName(`${dashboard.name} (Copy)`);
    setNewDescription(dashboard.description || "");
    setShowCreate(true);
    setActiveMenu(null);
  };

  const filteredDashboards = dashboards.filter(
    (d) => d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            Dashboards
          </h1>
          <p className="text-muted-foreground mt-1">
            Create custom dashboards with your key metrics
          </p>
        </div>
        <Button 
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Dashboard
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Dashboards", value: dashboards.length.toString(), icon: LayoutDashboard, color: "text-cyan-500" },
          { label: "Default Dashboard", value: dashboards.filter(d => d.is_default).length.toString(), icon: Star, color: "text-amber-500" },
          { label: "Recently Updated", value: dashboards.filter(d => {
            const updated = new Date(d.updated_at);
            const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return updated > week;
          }).length.toString(), icon: RefreshCw, color: "text-emerald-500" },
          { label: "Active Views", value: "—", icon: Eye, color: "text-purple-500" },
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
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search dashboards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className="rounded-lg"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="rounded-lg"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={loadDashboards} className="rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-primary" />
                    Create New Dashboard
                  </CardTitle>
                  <CardDescription>
                    Build a custom dashboard with drag-and-drop widgets
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Dashboard Name</Label>
                  <Input
                    id="name"
                    placeholder="Marketing Overview"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-11 rounded-lg"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    placeholder="Track marketing metrics and KPIs"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="h-11 rounded-lg"
                  />
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
                        Create
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dashboard List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredDashboards.length === 0 ? (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto bg-cyan-100 dark:bg-cyan-900/30 rounded-2xl flex items-center justify-center mb-4">
              <LayoutDashboard className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-lg font-semibold">No dashboards yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Create custom dashboards to visualize your key metrics
            </p>
            <Button onClick={() => setShowCreate(true)} className="mt-6 rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Create Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDashboards.map((dashboard) => (
            <Card 
              key={dashboard.id} 
              className="border-0 shadow-lg bg-white dark:bg-slate-800/50 hover:shadow-xl transition-shadow cursor-pointer group"
            >
              <CardContent className="p-0">
                {/* Preview Area */}
                <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative overflow-hidden rounded-t-xl">
                  <div className="absolute inset-0 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                    <Eye className="w-8 h-8 text-slate-400 group-hover:text-white transition-colors" />
                  </div>
                  {/* Mock chart preview */}
                  <div className="absolute inset-4 grid grid-cols-3 gap-2 opacity-30">
                    <div className="bg-cyan-500 rounded h-full"></div>
                    <div className="bg-blue-500 rounded h-2/3 self-end"></div>
                    <div className="bg-purple-500 rounded h-4/5 self-end"></div>
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                        <LayoutDashboard className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {dashboard.name}
                          {dashboard.is_default && (
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          )}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Updated {formatDate(dashboard.updated_at)}
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === dashboard.id ? null : dashboard.id);
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                      {activeMenu === dashboard.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                          <button
                            onClick={() => {
                              setSelectedDashboard(dashboard);
                              setShowViewModal(true);
                              setActiveMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDashboard(dashboard);
                              setShowEditModal(true);
                              setActiveMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDuplicate(dashboard)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                          >
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleDelete(dashboard.id)}
                            className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {dashboard.description && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                      {dashboard.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDashboards.map((dashboard) => (
            <Card 
              key={dashboard.id} 
              className="border-0 shadow-lg bg-white dark:bg-slate-800/50 hover:shadow-xl transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <LayoutDashboard className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {dashboard.name}
                        {dashboard.is_default && (
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {dashboard.description || "No description"} • Updated {formatDate(dashboard.updated_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-lg"
                      onClick={() => {
                        setSelectedDashboard(dashboard);
                        setShowViewModal(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-lg"
                      onClick={() => {
                        setSelectedDashboard(dashboard);
                        setShowEditModal(true);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-lg text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(dashboard.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedDashboard && (
        <ViewDashboardModal 
          dashboard={selectedDashboard} 
          onClose={() => {
            setShowViewModal(false);
            setSelectedDashboard(null);
          }} 
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedDashboard && (
        <EditDashboardModal 
          dashboard={selectedDashboard} 
          onClose={() => {
            setShowEditModal(false);
            setSelectedDashboard(null);
          }}
          onSave={(updated) => {
            setDashboards(prev => prev.map(d => d.id === updated.id ? updated : d));
          }}
        />
      )}
    </div>
  );
}
