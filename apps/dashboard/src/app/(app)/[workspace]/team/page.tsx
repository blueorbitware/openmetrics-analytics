"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, UserPlus, Mail, Shield, Crown, MoreVertical, Edit, Trash2, 
  Activity, MessageSquare, Calendar, Plus, X, Send, AtSign, ChevronRight,
  Clock, BarChart3, GitBranch, Eye, CheckCircle2, Loader2, User
} from "lucide-react";
import { api } from "@/lib/api";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "admin" | "user";
  joined_at: string;
  last_active?: string;
}

interface ActivityItem {
  id: string;
  user: { name: string; avatar?: string };
  action: string;
  target_type: string;
  target_name: string;
  created_at: string;
}

interface Annotation {
  id: string;
  user: { name: string; avatar?: string };
  title: string;
  description?: string;
  date: string;
  color: string;
}

interface Comment {
  id: string;
  user: { name: string; avatar?: string };
  content: string;
  target_type: string;
  target_name: string;
  created_at: string;
  replies?: Comment[];
}

// Real members will be loaded from API
const MOCK_MEMBERS: TeamMember[] = [];

// No mock data - activity will be fetched from API when available
const MOCK_ACTIVITY: ActivityItem[] = [];

// No mock data - annotations will be fetched from API when available
const MOCK_ANNOTATIONS: Annotation[] = [];

// No mock data - comments will be fetched from API when available
const MOCK_COMMENTS: Comment[] = [];

function InviteMemberModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    setSending(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSending(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Invite Team Member
          </CardTitle>
          <CardDescription>
            Send an invitation to join your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="h-11 rounded-lg"
            />
          </div>
          <div>
            <Label className="mb-3 block">Role</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRole("user")}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  role === "user"
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                }`}
              >
                <User className="w-5 h-5 mb-2 text-blue-500" />
                <p className="font-medium">Member</p>
                <p className="text-xs text-muted-foreground">View reports and dashboards</p>
              </button>
              <button
                onClick={() => setRole("admin")}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  role === "admin"
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                }`}
              >
                <Crown className="w-5 h-5 mb-2 text-amber-500" />
                <p className="font-medium">Admin</p>
                <p className="text-xs text-muted-foreground">Full access & settings</p>
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleInvite}
              disabled={!email || sending}
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Invite
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddAnnotationModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [color, setColor] = useState("#3b82f6");

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Add Annotation
          </CardTitle>
          <CardDescription>
            Mark important events on your analytics timeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Product Launch"
              className="h-11 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more context..."
              className="h-11 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-lg"
            />
          </div>
          <div>
            <Label className="mb-3 block">Color</Label>
            <div className="flex gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? "scale-125 ring-2 ring-offset-2 ring-slate-400" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!title}>
              <Plus className="w-4 h-4 mr-2" />
              Add Annotation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

function getActionIcon(action: string) {
  switch (action) {
    case "created":
      return <Plus className="w-3 h-3" />;
    case "viewed":
      return <Eye className="w-3 h-3" />;
    case "commented on":
      return <MessageSquare className="w-3 h-3" />;
    case "updated":
      return <Edit className="w-3 h-3" />;
    default:
      return <Activity className="w-3 h-3" />;
  }
}

export default function TeamPage() {
  const params = useParams();
  const workspaceSlug = params.workspace as string;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user from local storage
        const currentUser = await api.getCurrentUser();
        
        // Try to get workspace members from API
        try {
          const workspaces = await api.getWorkspaces();
          const workspace = workspaces.find(w => w.slug === workspaceSlug);
          
          if (workspace) {
            const apiMembers = await api.getWorkspaceMembers(workspace.id);
            const formattedMembers: TeamMember[] = apiMembers.map(m => ({
              id: m.user.id,
              name: m.user.name || m.user.email.split('@')[0],
              email: m.user.email,
              role: m.role as "admin" | "user",
              joined_at: m.created_at,
              last_active: m.user.last_login_at,
            }));
            setMembers(formattedMembers);
          } else {
            // If no workspace found, show current user as the only member
            setMembers([{
              id: currentUser.id,
              name: currentUser.name || currentUser.email.split('@')[0],
              email: currentUser.email,
              role: currentUser.is_super_admin ? "admin" : "user",
              joined_at: new Date().toISOString(),
            }]);
          }
        } catch {
          // If API fails, show current user as the only member
          setMembers([{
            id: currentUser.id,
            name: currentUser.name || currentUser.email.split('@')[0],
            email: currentUser.email,
            role: currentUser.is_super_admin ? "admin" : "user",
            joined_at: new Date().toISOString(),
          }]);
        }
        
        // TODO: Fetch activity, annotations, and comments from API when endpoints are available
        setActivity([]);
        setAnnotations([]);
        setComments([]);
      } catch (error) {
        console.error("Failed to fetch team data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workspaceSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            Team & Collaboration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage members, annotations, and collaborate on insights
          </p>
        </div>
        <Button 
          onClick={() => setShowInviteModal(true)}
          className="rounded-xl"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="flex flex-wrap w-full h-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
          <TabsTrigger value="members" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 py-2">
            <Users className="w-4 h-4 mr-2" />
            Members
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 py-2">
            <Activity className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="annotations" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 py-2">
            <Calendar className="w-4 h-4 mr-2" />
            Annotations
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 py-2">
            <MessageSquare className="w-4 h-4 mr-2" />
            Comments
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium">
                        {member.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.name}</span>
                          {member.role === "admin" && (
                            <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                              <Crown className="w-3 h-3" />
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">
                          Joined {new Date(member.joined_at).toLocaleDateString()}
                        </p>
                        {member.last_active && (
                          <p className="text-xs text-emerald-600">
                            Active {getTimeAgo(member.last_active)}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-lg">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activity.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-4">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center text-white text-xs font-medium">
                        {item.user.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      {index < activity.length - 1 && (
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-200 dark:bg-slate-700" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{item.user.name}</span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          {getActionIcon(item.action)}
                          {item.action}
                        </span>
                        <span className="text-primary">{item.target_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getTimeAgo(item.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Annotations Tab */}
        <TabsContent value="annotations" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAnnotationModal(true)} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Add Annotation
            </Button>
          </div>
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {annotations.map((annotation) => (
                  <div key={annotation.id} className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div 
                      className="w-1 h-12 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: annotation.color }} 
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{annotation.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(annotation.date).toLocaleDateString()}
                        </span>
                      </div>
                      {annotation.description && (
                        <p className="text-sm text-muted-foreground">{annotation.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Added by {annotation.user.name}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8">
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-4">
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-medium">
                  AU
                </div>
                <div className="flex-1 relative">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment... Use @mention to notify others"
                    className="h-10 rounded-lg pr-10"
                  />
                  <Button 
                    size="icon" 
                    className="absolute right-1 top-1 h-8 w-8 rounded-md"
                    disabled={!newComment.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {comments.map((comment) => (
              <Card key={comment.id} className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                      {comment.user.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{comment.user.name}</span>
                        <span className="text-xs text-muted-foreground">{getTimeAgo(comment.created_at)}</span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          on {comment.target_type}:
                          <span className="text-primary">{comment.target_name}</span>
                        </span>
                      </div>

                      {/* Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-4">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs">
                                {reply.user.name.split(" ").map(n => n[0]).join("")}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">{reply.user.name}</span>
                                  <span className="text-xs text-muted-foreground">{getTimeAgo(reply.created_at)}</span>
                                </div>
                                <p className="text-sm">{reply.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button variant="ghost" size="sm" className="mt-2 text-xs">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Reply
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showInviteModal && <InviteMemberModal onClose={() => setShowInviteModal(false)} />}
      {showAnnotationModal && <AddAnnotationModal onClose={() => setShowAnnotationModal(false)} />}
    </div>
  );
}
