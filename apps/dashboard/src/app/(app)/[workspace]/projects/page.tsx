"use client";

import { useEffect, useState } from "react";
import { api, Project } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { 
  Plus, Copy, Check, Globe, Code, Loader2, RefreshCw, Search,
  X, MoreVertical, Edit, Trash2, Key, Eye, EyeOff, Activity,
  CheckCircle2, XCircle
} from "lucide-react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [showSnippet, setShowSnippet] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editing, setEditing] = useState(false);
  const [rotating, setRotating] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await api.getProjects();
      setProjects(data);

      for (const proj of data) {
        try {
          const snippet = await api.getProjectSnippet(proj.id);
          setSnippets((prev) => ({ ...prev, [proj.id]: snippet.snippet }));
        } catch {}
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createProject(newName, newDomain || undefined);
      setShowCreate(false);
      setNewName("");
      setNewDomain("");
      loadProjects();
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (projectId: string) => {
    setDeleting(true);
    try {
      await api.deleteProject(projectId);
      setDeleteConfirm(null);
      setExpandedProject(null);
      loadProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProject) return;
    setEditing(true);
    try {
      await api.updateProject(editProject.id, {
        name: editName,
        domain: editDomain || undefined,
      });
      setEditProject(null);
      loadProjects();
    } catch (err) {
      console.error("Failed to update project:", err);
    } finally {
      setEditing(false);
    }
  };

  const handleRotateKeys = async (projectId: string) => {
    setRotating(projectId);
    try {
      await api.rotateProjectKeys(projectId);
      loadProjects();
    } catch (err) {
      console.error("Failed to rotate keys:", err);
    } finally {
      setRotating(null);
    }
  };

  const filteredProjects = projects.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) ||
           p.domain?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl">
              <Globe className="w-6 h-6 text-white" />
            </div>
            Projects
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your tracked websites and apps
          </p>
        </div>
        <Button 
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Projects", value: projects.length.toString(), icon: Globe, color: "text-indigo-500" },
          { label: "Active", value: projects.filter(p => p.is_active).length.toString(), icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Inactive", value: projects.filter(p => !p.is_active).length.toString(), icon: XCircle, color: "text-slate-500" },
          { label: "Tracking Events", value: "—", icon: Activity, color: "text-blue-500" },
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

      {/* Search */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 rounded-lg"
              />
            </div>
            <Button variant="outline" onClick={loadProjects} className="rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </Button>
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
                    <Globe className="w-5 h-5 text-primary" />
                    Create New Project
                  </CardTitle>
                  <CardDescription>
                    Add a new website or app to track
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
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    placeholder="My Website"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-11 rounded-lg"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain (optional)</Label>
                  <Input
                    id="domain"
                    placeholder="example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    className="h-11 rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    🔒 Security: Only events from this domain will be accepted. Prevents others from sending fake data.
                  </p>
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

      {/* Edit Modal */}
      {editProject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Edit className="w-5 h-5 text-primary" />
                    Edit Project
                  </CardTitle>
                  <CardDescription>
                    Update project settings
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditProject(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editName">Project Name</Label>
                  <Input
                    id="editName"
                    placeholder="My Website"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-11 rounded-lg"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editDomain">Domain</Label>
                  <Input
                    id="editDomain"
                    placeholder="example.com"
                    value={editDomain}
                    onChange={(e) => setEditDomain(e.target.value)}
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditProject(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editing} className="flex-1">
                    {editing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Project List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold">No projects yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Create your first project to start tracking analytics
            </p>
            <Button onClick={() => setShowCreate(true)} className="mt-6 rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
              <CardContent className="p-0">
                {/* Project Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                  onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                        <Globe className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {project.name}
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            project.is_active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                          }`}>
                            {project.is_active ? "Active" : "Inactive"}
                          </span>
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {project.domain || "No domain set"} • Created {formatDate(project.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(project.public_key, `key-${project.id}`);
                        }}
                      >
                        {copiedId === `key-${project.id}` ? (
                          <>
                            <Check className="w-4 h-4 mr-1 text-emerald-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Key className="w-4 h-4 mr-1" />
                            Copy Key
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedProject === project.id && (
                  <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
                    {/* Public Key */}
                    <div>
                      <Label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Public Key
                      </Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-sm font-mono">
                          {project.public_key}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-lg"
                          onClick={() => copyToClipboard(project.public_key, `pk-${project.id}`)}
                        >
                          {copiedId === `pk-${project.id}` ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Tracking Snippet */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm text-muted-foreground flex items-center gap-2">
                          <Code className="w-4 h-4" />
                          Tracking Snippet
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSnippet(prev => ({ ...prev, [project.id]: !prev[project.id] }))}
                          >
                            {showSnippet[project.id] ? (
                              <>
                                <EyeOff className="w-4 h-4 mr-1" />
                                Hide
                              </>
                            ) : (
                              <>
                                <Eye className="w-4 h-4 mr-1" />
                                Show
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => snippets[project.id] && copyToClipboard(snippets[project.id], `snippet-${project.id}`)}
                          >
                            {copiedId === `snippet-${project.id}` ? (
                              <>
                                <Check className="w-4 h-4 mr-1 text-emerald-500" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 mr-1" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      {showSnippet[project.id] && (
                        <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-sm overflow-x-auto">
                          {snippets[project.id] || "Loading..."}
                        </pre>
                      )}
                      {!showSnippet[project.id] && (
                        <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-xl text-sm text-muted-foreground">
                          Click "Show" to view the tracking code snippet
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Paste this snippet before the closing &lt;/body&gt; tag of your website.
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditProject(project);
                          setEditName(project.name);
                          setEditDomain(project.domain || "");
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        disabled={rotating === project.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRotateKeys(project.id);
                        }}
                      >
                        {rotating === project.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Key className="w-4 h-4 mr-2" />
                        )}
                        Rotate Keys
                      </Button>
                      {deleteConfirm === project.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-red-500 font-medium">Confirm?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-lg"
                            disabled={deleting}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(project.id);
                            }}
                          >
                            {deleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Yes, Delete"
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(project.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      )}
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
