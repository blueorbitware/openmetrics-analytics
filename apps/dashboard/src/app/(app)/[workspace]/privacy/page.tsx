"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Shield, Trash2, Download, Search, Plus, Clock, CheckCircle2, XCircle,
  Loader2, AlertTriangle, User, Mail, Hash, FileDown, History, RefreshCw,
  Lock, Eye, EyeOff
} from "lucide-react";

interface GDPRRequest {
  id: string;
  request_type: "deletion" | "export" | "access";
  identifier_type: "email" | "user_id" | "anon_id";
  identifier_value: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  completed_at?: string;
}

// No mock data - requests will be fetched from API when available
const MOCK_REQUESTS: GDPRRequest[] = [];

const RequestTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "deletion":
      return <Trash2 className="w-4 h-4" />;
    case "export":
      return <FileDown className="w-4 h-4" />;
    case "access":
      return <Eye className="w-4 h-4" />;
    default:
      return <Shield className="w-4 h-4" />;
  }
};

const StatusColors: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  pending: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: Clock },
  processing: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", icon: Loader2 },
  completed: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  failed: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", icon: XCircle },
};

const IdentifierIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "email":
      return <Mail className="w-4 h-4" />;
    case "user_id":
      return <User className="w-4 h-4" />;
    case "anon_id":
      return <Hash className="w-4 h-4" />;
    default:
      return <User className="w-4 h-4" />;
  }
};

function NewRequestModal({ onClose }: { onClose: () => void }) {
  const [requestType, setRequestType] = useState<string>("deletion");
  const [identifierType, setIdentifierType] = useState<string>("email");
  const [identifierValue, setIdentifierValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            New Privacy Request
          </CardTitle>
          <CardDescription>
            Submit a GDPR request for data deletion, export, or access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Request Type */}
          <div>
            <Label className="mb-3 block">Request Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "deletion", label: "Delete Data", icon: Trash2, color: "from-red-500 to-rose-600" },
                { id: "export", label: "Export Data", icon: FileDown, color: "from-blue-500 to-cyan-600" },
                { id: "access", label: "View Data", icon: Eye, color: "from-emerald-500 to-teal-600" },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setRequestType(type.id)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    requestType === type.id
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                  }`}
                >
                  <div className={`w-8 h-8 mx-auto mb-2 rounded-lg bg-gradient-to-br ${type.color} flex items-center justify-center`}>
                    <type.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Identifier Type */}
          <div>
            <Label className="mb-3 block">Identify User By</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "email", label: "Email", icon: Mail },
                { id: "user_id", label: "User ID", icon: User },
                { id: "anon_id", label: "Anonymous ID", icon: Hash },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setIdentifierType(type.id)}
                  className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all ${
                    identifierType === type.id
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                  }`}
                >
                  <type.icon className="w-4 h-4" />
                  <span className="text-sm">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Identifier Value */}
          <div className="space-y-2">
            <Label>
              {identifierType === "email" && "Email Address"}
              {identifierType === "user_id" && "User ID"}
              {identifierType === "anon_id" && "Anonymous ID"}
            </Label>
            <Input
              value={identifierValue}
              onChange={(e) => setIdentifierValue(e.target.value)}
              placeholder={
                identifierType === "email" ? "user@example.com" :
                identifierType === "user_id" ? "user_123abc" : "anon_xyz789"
              }
              className="h-11 rounded-lg"
            />
          </div>

          {/* Warning for deletion */}
          {requestType === "deletion" && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">Data Deletion Warning</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    This action is irreversible. All data associated with this identifier will be permanently deleted.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleSubmit}
              disabled={!identifierValue || submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RequestTypeIcon type={requestType} />
              )}
              <span className="ml-2">Submit Request</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PrivacyPage() {
  const [requests, setRequests] = useState<GDPRRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);

  useEffect(() => {
    // TODO: Fetch privacy requests from API when endpoint is available
    setRequests([]);
    setLoading(false);
  }, []);

  const filteredRequests = requests.filter((request) => {
    if (search && !request.identifier_value.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === "pending").length,
    completed: requests.filter(r => r.status === "completed").length,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            Privacy & GDPR
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage data deletion, export, and access requests
          </p>
        </div>
        <Button 
          onClick={() => setShowNewRequestModal(true)}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">GDPR Compliance</h3>
                <p className="text-emerald-100 text-sm">
                  Automatically handle user data requests as required by GDPR, CCPA, and other privacy regulations.
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-center">
              <div className="px-4 py-2 bg-white/10 rounded-lg">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-emerald-200">Total Requests</p>
              </div>
              <div className="px-4 py-2 bg-white/10 rounded-lg">
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-emerald-200">Pending</p>
              </div>
              <div className="px-4 py-2 bg-white/10 rounded-lg">
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-emerald-200">Completed</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            title: "Delete User Data",
            description: "Permanently remove all data for a user",
            icon: Trash2,
            color: "from-red-500 to-rose-600",
            action: "deletion",
          },
          {
            title: "Export User Data",
            description: "Download all data as JSON file",
            icon: Download,
            color: "from-blue-500 to-cyan-600",
            action: "export",
          },
          {
            title: "View User Data",
            description: "See what data is stored",
            icon: Eye,
            color: "from-emerald-500 to-teal-600",
            action: "access",
          },
        ].map((action) => (
          <Card 
            key={action.action} 
            className="border-0 shadow-lg bg-white dark:bg-slate-800/50 hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => setShowNewRequestModal(true)}
          >
            <CardContent className="p-5">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4`}>
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-1">{action.title}</h3>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Request History */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                Request History
              </CardTitle>
              <CardDescription>Track the status of privacy requests</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9 rounded-lg"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mt-4">No requests yet</h3>
              <p className="text-muted-foreground mt-2">
                Privacy requests will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request) => {
                const statusInfo = StatusColors[request.status];
                const StatusIcon = statusInfo.icon;
                
                return (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        request.request_type === "deletion" ? "bg-red-100 dark:bg-red-900/30 text-red-600" :
                        request.request_type === "export" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" :
                        "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                      }`}>
                        <RequestTypeIcon type={request.request_type} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{request.request_type}</span>
                          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
                            <StatusIcon className={`w-3 h-3 ${request.status === "processing" ? "animate-spin" : ""}`} />
                            {request.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <IdentifierIcon type={request.identifier_type} />
                          <span>{request.identifier_value}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                      {request.completed_at && (
                        <p className="text-emerald-600 text-xs">
                          Completed {new Date(request.completed_at).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Request Modal */}
      {showNewRequestModal && (
        <NewRequestModal onClose={() => setShowNewRequestModal(false)} />
      )}
    </div>
  );
}
