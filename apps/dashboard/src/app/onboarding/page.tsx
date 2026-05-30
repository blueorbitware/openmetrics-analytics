"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Building2, ArrowRight, Loader2, Sparkles } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const workspace = await api.createWorkspace(workspaceName);
      api.setWorkspace(workspace.id);
      router.push(`/${workspace.slug}/overview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Analytics</h1>
            <p className="text-blue-200 text-sm">Dashboard Platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome!</h2>
            <p className="text-blue-100/80">
              Let's create your first workspace to get started with analytics.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="workspace" className="text-sm font-medium text-blue-100">
                Workspace Name
              </Label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-300" />
                <Input
                  id="workspace"
                  type="text"
                  placeholder="My Company"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="pl-12 h-12 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-blue-200/50 focus:border-blue-400 focus:ring-blue-400"
                  required
                  minLength={2}
                />
              </div>
              <p className="text-xs text-blue-200/60">
                This is your organization or project name. You can create multiple workspaces later.
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-medium shadow-lg shadow-blue-500/25 transition-all duration-300"
              disabled={loading || workspaceName.length < 2}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating workspace...
                </>
              ) : (
                <>
                  Create Workspace
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-center text-sm text-blue-200/60">
              A workspace contains your projects, team members, and analytics data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
