"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { api, Workspace, Project } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Activity,
  GitBranch,
  Users,
  BarChart3,
  Settings,
  Megaphone,
  FolderKanban,
  LogOut,
  ChevronDown,
  Globe,
  Menu,
  X,
  Bell,
  Search,
  User,
  Moon,
  Sun,
  Zap,
  Brain,
  Video,
  MousePointer,
  MessageSquare,
  Shield,
} from "lucide-react";

const navigation = [
  { name: "Overview", href: "/overview", icon: LayoutDashboard, color: "text-blue-500" },
  { name: "Events", href: "/events", icon: Activity, color: "text-emerald-500" },
  { name: "Funnels", href: "/funnels", icon: GitBranch, color: "text-purple-500" },
  { name: "AI Insights", href: "/ai", icon: Brain, color: "text-violet-500" },
  { name: "Session Replay", href: "/replays", icon: Video, color: "text-rose-500" },
  { name: "Heatmaps", href: "/heatmaps", icon: MousePointer, color: "text-orange-500" },
  { name: "Surveys", href: "/surveys", icon: MessageSquare, color: "text-teal-500" },
];

const secondaryNav = [
  { name: "Retention", href: "/retention", icon: BarChart3 },
  { name: "Users", href: "/users", icon: Users },
  { name: "Sessions", href: "/sessions", icon: Zap },
  { name: "Dashboards", href: "/dashboards", icon: FolderKanban },
  { name: "Banners", href: "/banners", icon: Megaphone },
  { name: "Privacy", href: "/privacy", icon: Shield },
  { name: "Projects", href: "/projects", icon: Globe },
  { name: "Team", href: "/team", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const workspaceSlug = params.workspace as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; is_super_admin: boolean } | null>(null);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load current user
        const user = await api.getCurrentUser();
        setCurrentUser(user);
      } catch {
        // Not authenticated, redirect to login
        router.push("/login");
        return;
      }

      try {
        const ws = await api.getWorkspaces();
        setWorkspaces(ws);
        
        const current = ws.find((w) => w.slug === workspaceSlug);
        if (current) {
          setWorkspace(current);
          api.setWorkspace(current.id);
          
          // Try to load projects, but don't fail if it errors
          try {
            const projs = await api.getProjects();
            setProjects(projs);
            
            if (projs.length > 0) {
              const savedProjectId = localStorage.getItem("selected_project");
              const proj = projs.find((p) => p.id === savedProjectId) || projs[0];
              setSelectedProject(proj);
              localStorage.setItem("selected_project", proj.id);
            }
          } catch (projErr) {
            console.error("Failed to load projects:", projErr);
            // Continue without projects
          }
        } else if (ws.length > 0) {
          router.push(`/${ws[0].slug}/overview`);
        }
      } catch (err) {
        console.error("Failed to load workspaces:", err);
        // Stay on page but show error state
      }
    };

    loadData();
  }, [workspaceSlug, router]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleLogout = async () => {
    await api.logout();
    router.push("/login");
  };

  const handleSwitchWorkspace = (ws: Workspace) => {
    setShowWorkspaceMenu(false);
    router.push(`/${ws.slug}/overview`);
  };

  const handleSwitchProject = (proj: Project) => {
    setSelectedProject(proj);
    localStorage.setItem("selected_project", proj.id);
    setShowProjectMenu(false);
    window.location.reload();
  };

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo & Workspace */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-lg">Analytics</h1>
                  <p className="text-xs text-muted-foreground">Dashboard</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Workspace Selector */}
            <div className="relative">
              <button
                onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    {workspace.name[0]}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm truncate max-w-[140px]">{workspace.name}</p>
                    <p className="text-xs text-muted-foreground">{workspace.plan} plan</p>
                  </div>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showWorkspaceMenu && "rotate-180")} />
              </button>

              {showWorkspaceMenu && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => handleSwitchWorkspace(ws)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors",
                        ws.id === workspace.id && "bg-slate-100 dark:bg-slate-700"
                      )}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-primary/80 to-accent/80 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        {ws.name[0]}
                      </div>
                      <span className="font-medium text-sm">{ws.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Project Selector */}
            {projects.length > 0 && (
              <div className="relative mt-3">
                <button
                  onClick={() => setShowProjectMenu(!showProjectMenu)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <span className="truncate max-w-[160px]">
                      {selectedProject?.name || "Select project"}
                    </span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showProjectMenu && "rotate-180")} />
                </button>

                {showProjectMenu && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 max-h-60 overflow-y-auto scrollbar-thin">
                    {projects.map((proj) => (
                      <button
                        key={proj.id}
                        onClick={() => handleSwitchProject(proj)}
                        className={cn(
                          "w-full flex items-center gap-2 p-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm",
                          proj.id === selectedProject?.id && "bg-slate-100 dark:bg-slate-700"
                        )}
                      >
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span>{proj.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
              Analytics
            </p>
            {navigation.map((item) => {
              const href = `/${workspaceSlug}${item.href}`;
              const isActive = pathname === href || pathname.startsWith(href + "/");

              return (
                <Link
                  key={item.name}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "nav-item group",
                    isActive ? "nav-item-active" : "nav-item-inactive"
                  )}
                >
                  <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-white" : item.color)} />
                  <span>{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </Link>
              );
            })}

            <div className="my-4 border-t border-slate-200 dark:border-slate-800" />
            
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
              Manage
            </p>
            {secondaryNav.map((item) => {
              const href = `/${workspaceSlug}${item.href}`;
              const isActive = pathname === href || pathname.startsWith(href + "/");

              return (
                <Link
                  key={item.name}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "nav-item",
                    isActive ? "nav-item-active" : "nav-item-inactive"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 p-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                {currentUser?.name?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{currentUser?.name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{currentUser?.email || ""}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start mt-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-72">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Search */}
            <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search events, users, pages..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDarkMode(!darkMode)}
                className="rounded-lg"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              
              <Button variant="ghost" size="icon" className="rounded-lg relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </Button>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {currentUser?.name?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                </Button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                      <p className="font-medium">{currentUser?.name || "User"}</p>
                      <p className="text-sm text-muted-foreground">{currentUser?.email || ""}</p>
                      {currentUser?.is_super_admin && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-full">
                          <Shield className="w-3 h-3" />
                          Super Admin
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <Link
                        href={`/${workspaceSlug}/profile`}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm">Profile Settings</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-red-500 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm">Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
