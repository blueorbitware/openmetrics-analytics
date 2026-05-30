"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Users, Search, User, Mail, Globe, Smartphone, Monitor, Calendar,
  Activity, Clock, MapPin, ChevronRight, Eye, Filter, Download,
  Loader2, RefreshCw, TrendingUp, MousePointer
} from "lucide-react";

interface UserProfile {
  id: string;
  anon_id: string;
  user_id?: string;
  email?: string;
  first_seen: string;
  last_seen: string;
  total_events: number;
  total_sessions: number;
  total_page_views: number;
  country?: string;
  city?: string;
  device_type: string;
  browser: string;
  os: string;
}

// No mock data - users will be fetched from API when available
const MOCK_USERS: UserProfile[] = [];

const DeviceIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "mobile":
      return <Smartphone className="w-4 h-4" />;
    case "tablet":
      return <Monitor className="w-4 h-4" />;
    default:
      return <Monitor className="w-4 h-4" />;
  }
};

export default function UsersPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params.workspace as string;

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    // TODO: Fetch users from API when endpoint is available
    setUsers([]);
    setLoading(false);
  }, []);

  const filteredUsers = users.filter((user) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      user.anon_id.toLowerCase().includes(searchLower) ||
      user.user_id?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.city?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    total: users.length,
    identified: users.filter(u => u.user_id || u.email).length,
    activeToday: 0, // Will be calculated from real data when API is available
    avgEvents: users.length > 0 ? Math.round(users.reduce((sum, u) => sum + u.total_events, 0) / users.length) : 0,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            Users
          </h1>
          <p className="text-muted-foreground mt-1">
            Explore individual user profiles and journeys
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            className="rounded-xl"
            onClick={() => {
              setLoading(true);
              // TODO: Fetch users from API when endpoint is available
              setUsers([]);
              setLoading(false);
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: stats.total.toLocaleString(), icon: Users, color: "text-blue-500" },
          { label: "Identified", value: stats.identified.toLocaleString(), icon: User, color: "text-emerald-500" },
          { label: "Active Today", value: stats.activeToday.toLocaleString(), icon: Activity, color: "text-amber-500" },
          { label: "Avg Events/User", value: stats.avgEvents.toLocaleString(), icon: MousePointer, color: "text-purple-500" },
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
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by user ID, email, or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 rounded-lg"
              />
            </div>
            <Button variant="outline" className="rounded-lg">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mt-4">No users found</h3>
            <p className="text-muted-foreground mt-2">
              Try adjusting your search criteria
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <Card
              key={user.id}
              className="border-0 shadow-lg bg-white dark:bg-slate-800/50 hover:shadow-xl transition-shadow cursor-pointer group"
              onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                      {user.email?.[0].toUpperCase() || user.anon_id[5].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {user.email || user.user_id || user.anon_id}
                        </span>
                        {(user.email || user.user_id) && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                            Identified
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DeviceIcon type={user.device_type} />
                          {user.browser} / {user.os}
                        </span>
                        {user.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {user.city}, {user.country}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {user.total_events} events
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">Last seen</p>
                      <p>{new Date(user.last_seen).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${selectedUser?.id === user.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Expanded details */}
                {selectedUser?.id === user.id && (
                  <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Total Sessions</p>
                      <p className="text-lg font-semibold">{user.total_sessions}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Page Views</p>
                      <p className="text-lg font-semibold">{user.total_page_views}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">First Seen</p>
                      <p className="text-sm font-medium">{new Date(user.first_seen).toLocaleDateString()}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Anonymous ID</p>
                      <p className="text-xs font-mono truncate">{user.anon_id}</p>
                    </div>
                    <div className="col-span-2 md:col-span-4 flex gap-2">
                      <Button 
                        size="sm" 
                        className="rounded-lg"
                        onClick={() => router.push(`/${workspaceSlug}/events?user=${user.user_id || user.anon_id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Timeline
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="rounded-lg"
                        onClick={() => router.push(`/${workspaceSlug}/privacy?action=export&identifier=${user.user_id || user.anon_id}`)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Data
                      </Button>
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
