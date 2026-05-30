"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  MessageSquare, Plus, Star, ThumbsUp, CheckSquare, Type, Settings2,
  Search, Filter, BarChart3, Users, TrendingUp, Loader2, Play, Pause,
  Eye, Edit, Trash2, Copy, ChevronRight, X, Calendar, Target
} from "lucide-react";

interface Survey {
  id: string;
  name: string;
  survey_type: "nps" | "rating" | "multiple_choice" | "free_text";
  status: "draft" | "active" | "paused" | "completed";
  response_count: number;
  display_type: "modal" | "slideout" | "tooltip" | "banner";
  created_at: string;
  start_at?: string;
  end_at?: string;
}

// No mock data - surveys will be fetched from API when available
const MOCK_SURVEYS: Survey[] = [];

const SurveyTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "nps":
      return <ThumbsUp className="w-4 h-4" />;
    case "rating":
      return <Star className="w-4 h-4" />;
    case "multiple_choice":
      return <CheckSquare className="w-4 h-4" />;
    case "free_text":
      return <Type className="w-4 h-4" />;
    default:
      return <MessageSquare className="w-4 h-4" />;
  }
};

const StatusColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  active: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
  paused: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
  completed: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" },
};

const SurveyTypeLabels: Record<string, string> = {
  nps: "NPS",
  rating: "Rating",
  multiple_choice: "Multiple Choice",
  free_text: "Free Text",
};

function CreateSurveyModal({ onClose, onSave }: { onClose: () => void; onSave: (survey: Survey) => void }) {
  const [step, setStep] = useState(1);
  const [surveyType, setSurveyType] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [displayType, setDisplayType] = useState<string>("modal");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    const newSurvey: Survey = {
      id: Date.now().toString(),
      name,
      survey_type: surveyType as Survey["survey_type"],
      status: "draft",
      response_count: 0,
      display_type: displayType as Survey["display_type"],
      created_at: new Date().toISOString(),
    };
    onSave(newSurvey);
    setSaving(false);
    onClose();
  };

  const surveyTypes = [
    { id: "nps", name: "NPS Survey", desc: "Net Promoter Score (0-10)", icon: ThumbsUp, color: "from-blue-500 to-cyan-500" },
    { id: "rating", name: "Star Rating", desc: "1-5 star rating", icon: Star, color: "from-amber-500 to-orange-500" },
    { id: "multiple_choice", name: "Multiple Choice", desc: "Select from options", icon: CheckSquare, color: "from-emerald-500 to-teal-500" },
    { id: "free_text", name: "Free Text", desc: "Open-ended response", icon: Type, color: "from-purple-500 to-pink-500" },
  ];

  const displayTypes = [
    { id: "modal", name: "Modal", desc: "Center popup" },
    { id: "slideout", name: "Slide-out", desc: "Side panel" },
    { id: "tooltip", name: "Tooltip", desc: "Small popup near element" },
    { id: "banner", name: "Banner", desc: "Top or bottom bar" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-0 shadow-2xl">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Create New Survey</CardTitle>
              <CardDescription>Step {step} of 3</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          {/* Progress */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">Choose Survey Type</h3>
                <div className="grid grid-cols-2 gap-4">
                  {surveyTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSurveyType(type.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        surveyType === type.id
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${type.color} flex items-center justify-center mb-3`}>
                        <type.icon className="w-5 h-5 text-white" />
                      </div>
                      <p className="font-medium">{type.name}</p>
                      <p className="text-sm text-muted-foreground">{type.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Survey Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Customer Satisfaction Survey"
                  className="h-11 rounded-lg"
                />
              </div>
              <div>
                <Label className="mb-3 block">Display Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {displayTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setDisplayType(type.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        displayType === type.id
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium text-sm">{type.name}</p>
                      <p className="text-xs text-muted-foreground">{type.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                  <CheckSquare className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Survey Ready!</h3>
                <p className="text-muted-foreground">
                  Your "{name}" survey is ready to launch. You can configure targeting rules and question details after creation.
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <h4 className="font-medium mb-3">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{SurveyTypeLabels[surveyType || "nps"]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Display</span>
                    <span className="font-medium capitalize">{displayType}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            >
              {step > 1 ? "Back" : "Cancel"}
            </Button>
            <Button
              onClick={() => step < 3 ? setStep(step + 1) : handleCreate()}
              disabled={(step === 1 && !surveyType) || (step === 2 && !name) || saving}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {step === 3 ? "Create Survey" : "Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SurveyResultsModal({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  const mockResults = {
    nps: { promoters: 45, passives: 30, detractors: 25, score: 20 },
    responses: [
      { id: "1", score: 9, comment: "Great product!", date: "2024-01-15" },
      { id: "2", score: 7, comment: "Could be better", date: "2024-01-14" },
      { id: "3", score: 10, comment: "Amazing experience", date: "2024-01-13" },
    ]
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-0 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{survey.name} - Results</CardTitle>
              <CardDescription>{survey.response_count} total responses</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 overflow-y-auto">
          {survey.survey_type === "nps" && (
            <div className="mb-6">
              <h4 className="font-semibold mb-4">NPS Score</h4>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-4xl font-bold text-primary">{mockResults.nps.score}</div>
                <div className="flex-1">
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1 h-3 bg-emerald-500 rounded" style={{ flex: mockResults.nps.promoters }} />
                    <div className="flex-1 h-3 bg-amber-500 rounded" style={{ flex: mockResults.nps.passives }} />
                    <div className="flex-1 h-3 bg-red-500 rounded" style={{ flex: mockResults.nps.detractors }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Promoters: {mockResults.nps.promoters}%</span>
                    <span>Passives: {mockResults.nps.passives}%</span>
                    <span>Detractors: {mockResults.nps.detractors}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <h4 className="font-semibold mb-4">Recent Responses</h4>
          <div className="space-y-3">
            {mockResults.responses.map((response) => (
              <div key={response.id} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Score: {response.score}/10</span>
                  <span className="text-xs text-muted-foreground">{response.date}</span>
                </div>
                <p className="text-sm text-muted-foreground">{response.comment}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EditSurveyModal({ survey, onClose, onSave }: { survey: Survey; onClose: () => void; onSave: (survey: Survey) => void }) {
  const [name, setName] = useState(survey.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    onSave({ ...survey, name });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Edit Survey</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Survey Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
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

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    // TODO: Fetch surveys from API when endpoint is available
    // For now, show empty state
    setSurveys([]);
    setLoading(false);
  }, []);

  const filteredSurveys = surveys.filter((survey) => {
    if (search && !survey.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (statusFilter && survey.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const stats = {
    total: surveys.length,
    active: surveys.filter(s => s.status === "active").length,
    responses: surveys.reduce((sum, s) => sum + s.response_count, 0),
    avgNps: surveys.length > 0 ? Math.round(surveys.reduce((sum, s) => sum + s.response_count, 0) / surveys.length) : 0,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            Surveys & Feedback
          </h1>
          <p className="text-muted-foreground mt-1">
            Collect feedback with NPS, ratings, and custom surveys
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Survey
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Surveys", value: stats.total.toString(), icon: MessageSquare, color: "text-teal-500" },
          { label: "Active Surveys", value: stats.active.toString(), icon: Play, color: "text-emerald-500" },
          { label: "Total Responses", value: stats.responses.toLocaleString(), icon: Users, color: "text-blue-500" },
          { label: "Avg NPS Score", value: stats.avgNps.toString(), icon: TrendingUp, color: "text-amber-500" },
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
                placeholder="Search surveys..."
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Survey List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredSurveys.length === 0 ? (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mt-4">No surveys found</h3>
            <p className="text-muted-foreground mt-2">
              Create your first survey to start collecting feedback
            </p>
            <Button onClick={() => setShowCreateModal(true)} className="mt-6 rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Create Survey
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSurveys.map((survey) => {
            const statusColor = StatusColors[survey.status];
            return (
              <Card
                key={survey.id}
                className="border-0 shadow-lg bg-white dark:bg-slate-800/50 hover:shadow-xl transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center">
                        <SurveyTypeIcon type={survey.survey_type} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{survey.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor.bg} ${statusColor.text}`}>
                            {survey.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <SurveyTypeIcon type={survey.survey_type} />
                            {SurveyTypeLabels[survey.survey_type]}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {survey.response_count} responses
                          </span>
                          <span className="capitalize">{survey.display_type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {survey.status === "active" ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-lg"
                          onClick={() => setSurveys(prev => prev.map(s => s.id === survey.id ? {...s, status: "paused"} : s))}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pause
                        </Button>
                      ) : survey.status === "paused" || survey.status === "draft" ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-lg"
                          onClick={() => setSurveys(prev => prev.map(s => s.id === survey.id ? {...s, status: "active"} : s))}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Launch
                        </Button>
                      ) : null}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-lg"
                        onClick={() => {
                          setSelectedSurvey(survey);
                          setShowResultsModal(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Results
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="rounded-lg"
                        onClick={() => {
                          setSelectedSurvey(survey);
                          setShowEditModal(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="rounded-lg text-red-500 hover:text-red-600"
                        onClick={() => {
                          if (confirm(`Delete survey "${survey.name}"?`)) {
                            setSurveys(prev => prev.filter(s => s.id !== survey.id));
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateSurveyModal 
          onClose={() => setShowCreateModal(false)} 
          onSave={(newSurvey) => setSurveys(prev => [newSurvey, ...prev])}
        />
      )}

      {/* Results Modal */}
      {showResultsModal && selectedSurvey && (
        <SurveyResultsModal 
          survey={selectedSurvey} 
          onClose={() => {
            setShowResultsModal(false);
            setSelectedSurvey(null);
          }} 
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedSurvey && (
        <EditSurveyModal 
          survey={selectedSurvey} 
          onClose={() => {
            setShowEditModal(false);
            setSelectedSurvey(null);
          }}
          onSave={(updated) => {
            setSurveys(prev => prev.map(s => s.id === updated.id ? updated : s));
          }}
        />
      )}
    </div>
  );
}
