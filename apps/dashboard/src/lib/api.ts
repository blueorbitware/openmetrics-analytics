// Auto-detect API URL based on environment
const getApiUrl = () => {
  // Check for environment variable first
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Auto-detect based on current hostname (client-side)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts[0] === 'analytics-dashboard' || parts[0].endsWith('-dashboard')) {
      const apiHost = hostname.replace(/dashboard/, 'api');
      return `${window.location.protocol}//${apiHost}`;
    }
    if (hostname.includes('.cap.') || hostname.includes('analytics-dashboard')) {
      // Extract base domain and construct API URL
      const baseDomain = hostname.replace('analytics-dashboard.', 'analytics-api.');
      return `https://${baseDomain}`;
    }
  }
  
  // Default to localhost for development
  return "http://localhost:8080";
};

const API_URL = getApiUrl();

interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  is_super_admin: boolean;
  avatar_url?: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  branding: Record<string, unknown>;
  custom_domain?: string;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  workspace_id: string;
  name: string;
  public_key: string;
  domain?: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Banner {
  id: string;
  project_id: string;
  name: string;
  status: "draft" | "active" | "paused" | "archived";
  config: Record<string, unknown>;
  targeting: Record<string, unknown>;
  frequency_cap_per_user: number;
  frequency_cap_days: number;
  start_at?: string;
  end_at?: string;
  created_at: string;
  updated_at: string;
}

interface Dashboard {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  layout: unknown[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface EventsReportResponse {
  data: Array<{
    timestamp: string;
    count: number;
    unique_users: number;
    breakdown?: Record<string, number>;
  }>;
  meta: {
    total_count: number;
    total_unique_users: number;
    query_time_ms: number;
  };
}

interface FunnelReportResponse {
  steps: Array<{
    step_number: number;
    event_name: string;
    count: number;
    conversion_rate: number;
    dropoff_rate: number;
  }>;
  overall_conversion: number;
  meta: { query_time_ms: number };
}

interface RetentionReportResponse {
  cohorts: Array<{
    cohort_date: string;
    cohort_size: number;
    retention_data: number[];
  }>;
  average: number[];
  meta: { query_time_ms: number };
}

interface RawEvent {
  event_id: string;
  event_name: string;
  event_type: string;
  timestamp: string;
  received_at: string;
  anon_id: string;
  user_id?: string;
  session_id: string;
  url: string;
  path: string;
  title: string;
  referrer: string;
  query_string?: string;
  utm_params?: Record<string, string>;
  ref_source: string;
  ref_source_category: string;
  ref_medium: string;
  country: string;
  city: string;
  browser: string;
  os: string;
  device_type: string;
  revenue?: number;
  order_id?: string;
  product_id?: string;
  product_name?: string;
  properties?: Record<string, string>;
}

interface RawEventsResponse {
  events: RawEvent[];
  total: number;
  limit: number;
  offset: number;
}

interface WorkspaceSettings {
  workspace_id: string;
  ai_openai_key: string;
  ai_claude_key: string;
  ai_gemini_key: string;
  ai_deepseek_key: string;
  ai_kimi_key: string;
  ai_default_provider: string;
  ai_enabled: boolean;
  storage_provider: string;
  storage_s3_bucket: string;
  storage_s3_region: string;
  storage_s3_access_key: string;
  storage_gcs_bucket: string;
  storage_gcs_project_id: string;
  storage_gcs_credentials: string;
  pii_masking_enabled: boolean;
  pii_mask_emails: boolean;
  pii_mask_phones: boolean;
  pii_mask_credit_cards: boolean;
  pii_custom_patterns: string[];
  data_retention_days: number;
  gdpr_enabled: boolean;
  replay_enabled: boolean;
  replay_sample_rate: number;
  replay_mask_inputs: boolean;
  replay_mask_text: boolean;
  heatmap_enabled: boolean;
  heatmap_click: boolean;
  heatmap_scroll: boolean;
  heatmap_movement: boolean;
}

interface AIInsight {
  id: string;
  workspace_id: string;
  project_id?: string;
  insight_type: string;
  title: string;
  description: string;
  severity: string;
  metric_name?: string;
  metric_value?: number;
  metric_change?: number;
  data: Record<string, unknown>;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

interface AIQuery {
  id: string;
  workspace_id: string;
  user_id: string;
  query_text: string;
  generated_sql?: string;
  result_summary?: string;
  result_data?: Record<string, unknown>;
  tokens_used: number;
  latency_ms: number;
  created_at: string;
}

interface AIQueryResponse {
  id: string;
  query: string;
  generated_sql?: string;
  result_summary?: string;
  result_data?: Record<string, unknown>;
  tokens_used: number;
  latency_ms: number;
}

interface SummaryResponse {
  total_events: number;
  total_page_views: number;
  total_sessions: number;
  total_unique_users: number;
  total_revenue: number;
  bounce_rate: number;
  avg_session_duration_seconds: number;
  avg_time_on_page_seconds: number;
  avg_page_views_per_session: number;
  new_users_percent: number;
  top_sources: Array<{
    source: string;
    category: string;
    count: number;
    percent: number;
  }>;
  top_pages: Array<{
    path: string;
    views: number;
    unique_views: number;
    avg_time_seconds: number;
    bounce_rate: number;
  }>;
  top_parameters: Array<{
    parameter: string;
    value: string;
    count: number;
  }>;
  by_device: Array<{
    device_type: string;
    count: number;
    percent: number;
  }>;
  by_country: Array<{
    country: string;
    count: number;
    percent: number;
  }>;
  by_browser: Array<{
    browser: string;
    count: number;
    percent: number;
  }>;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private workspaceId: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.accessToken = localStorage.getItem("access_token");
      this.refreshToken = localStorage.getItem("refresh_token");
      this.workspaceId = localStorage.getItem("workspace_id");
    }
  }

  setTokens(access: string, refresh: string, user?: { id: string; email: string; name: string; is_super_admin: boolean }) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    if (user) {
      localStorage.setItem("auth", JSON.stringify({ user, access_token: access, refresh_token: refresh }));
    }
  }

  setWorkspace(id: string) {
    this.workspaceId = id;
    localStorage.setItem("workspace_id", id);
  }

  clearAuth() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("auth");
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    if (this.workspaceId) {
      headers["X-Workspace-ID"] = this.workspaceId;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.accessToken}`;
        const retryResponse = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers,
        });
        if (!retryResponse.ok) {
          throw new Error(await retryResponse.text());
        }
        return retryResponse.json();
      } else {
        this.clearAuth();
        window.location.href = "/login";
        throw new Error("Session expired");
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || "Request failed");
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (!response.ok) return false;

      const data: AuthResponse = await response.json();
      this.setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(data.access_token, data.refresh_token, data.user);
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request("/v1/auth/logout", { method: "POST" });
    } finally {
      this.clearAuth();
    }
  }

  async getWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>("/v1/workspaces");
  }

  async getWorkspace(id: string): Promise<Workspace> {
    return this.request<Workspace>(`/v1/workspaces/${id}`);
  }

  async createWorkspace(name: string): Promise<Workspace> {
    return this.request<Workspace>("/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async getWorkspaceMembers(workspaceId: string): Promise<Array<{
    user_id: string;
    workspace_id: string;
    role: string;
    created_at: string;
    user: {
      id: string;
      email: string;
      name: string;
      is_super_admin: boolean;
      avatar_url?: string;
      last_login_at?: string;
    };
  }>> {
    return this.request(`/v1/workspaces/${workspaceId}/members`);
  }

  async inviteWorkspaceMember(workspaceId: string, email: string, role: string): Promise<void> {
    return this.request(`/v1/workspaces/${workspaceId}/invite`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  }

  async getCurrentUser(): Promise<{
    id: string;
    email: string;
    name: string;
    is_super_admin: boolean;
    avatar_url?: string;
  }> {
    const data = localStorage.getItem("auth");
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.user;
    }
    throw new Error("Not authenticated");
  }

  async updateProfile(data: { name?: string; email?: string; current_password?: string }): Promise<void> {
    return this.request("/v1/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.request("/v1/auth/password", {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }

  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>("/v1/projects");
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/v1/projects/${id}`);
  }

  async createProject(name: string, domain?: string): Promise<Project> {
    return this.request<Project>("/v1/projects", {
      method: "POST",
      body: JSON.stringify({ name, domain }),
    });
  }

  async getProjectSnippet(id: string): Promise<{ snippet: string; public_key: string }> {
    return this.request(`/v1/projects/${id}/snippet`);
  }

  async deleteProject(id: string): Promise<void> {
    return this.request(`/v1/projects/${id}`, { method: "DELETE" });
  }

  async updateProject(id: string, data: { name?: string; domain?: string; is_active?: boolean }): Promise<Project> {
    return this.request<Project>(`/v1/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async rotateProjectKeys(id: string): Promise<{ public_key: string }> {
    return this.request(`/v1/projects/${id}/rotate-keys`, { method: "POST" });
  }

  async getBanners(projectId?: string): Promise<Banner[]> {
    const query = projectId ? `?project_id=${projectId}` : "";
    return this.request<Banner[]>(`/v1/banners${query}`);
  }

  async createBanner(data: Partial<Banner>): Promise<Banner> {
    return this.request<Banner>("/v1/banners", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBanner(id: string, data: Partial<Banner>): Promise<Banner> {
    return this.request<Banner>(`/v1/banners/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getDashboards(projectId?: string): Promise<Dashboard[]> {
    const query = projectId ? `?project_id=${projectId}` : "";
    return this.request<Dashboard[]>(`/v1/dashboards${query}`);
  }

  async reportEvents(params: {
    project_id: string;
    event_name?: string;
    time_range: { start: string; end: string };
    interval?: string;
    filters?: Array<{ property: string; operator: string; value: unknown }>;
    breakdown?: string;
  }): Promise<EventsReportResponse> {
    const body = { ...params, project_id_str: params.project_id };
    if (params.project_id === "all") {
      body.project_id = "00000000-0000-0000-0000-000000000000";
    }
    return this.request<EventsReportResponse>("/v1/reports/events", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async reportFunnel(params: {
    project_id: string;
    steps: Array<{ event_name: string }>;
    time_range: { start: string; end: string };
    conversion_window_hours?: number;
  }): Promise<FunnelReportResponse> {
    return this.request<FunnelReportResponse>("/v1/reports/funnel", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async reportRetention(params: {
    project_id: string;
    start_event: string;
    return_event: string;
    time_range: { start: string; end: string };
    retention_period?: string;
    periods?: number;
  }): Promise<RetentionReportResponse> {
    return this.request<RetentionReportResponse>("/v1/reports/retention", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getUserTimeline(anonId: string, projectId: string): Promise<unknown> {
    return this.request(`/v1/reports/users/${anonId}?project_id=${projectId}`);
  }

  async getSession(sessionId: string, projectId: string): Promise<unknown> {
    return this.request(`/v1/reports/sessions/${sessionId}?project_id=${projectId}`);
  }

  async getRawEvents(params: {
    project_id: string;
    event_name?: string;
    limit?: number;
    offset?: number;
  }): Promise<RawEventsResponse> {
    const query = new URLSearchParams({
      project_id: params.project_id,
      ...(params.event_name && { event_name: params.event_name }),
      ...(params.limit && { limit: params.limit.toString() }),
      ...(params.offset && { offset: params.offset.toString() }),
    });
    return this.request<RawEventsResponse>(`/v1/reports/raw?${query}`);
  }

  async getSummary(params: {
    project_id: string;
    start?: string;
    end?: string;
  }): Promise<SummaryResponse> {
    const query = new URLSearchParams({
      project_id: params.project_id,
      ...(params.start && { start: params.start }),
      ...(params.end && { end: params.end }),
    });
    return this.request<SummaryResponse>(`/v1/reports/summary?${query}`);
  }

  async getWorkspaceSettings(): Promise<WorkspaceSettings> {
    return this.request<WorkspaceSettings>("/v1/settings");
  }

  async updateWorkspaceSettings(settings: Partial<WorkspaceSettings>): Promise<{ status: string }> {
    return this.request("/v1/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  async testAIConnection(provider: string, apiKey: string): Promise<{ valid: boolean; message: string }> {
    return this.request("/v1/settings/test-ai", {
      method: "POST",
      body: JSON.stringify({ provider, api_key: apiKey }),
    });
  }

  async testStorageConnection(config: {
    provider: string;
    s3_bucket?: string;
    s3_region?: string;
    s3_access_key?: string;
    s3_secret_key?: string;
    gcs_bucket?: string;
    gcs_project_id?: string;
    gcs_credentials?: string;
  }): Promise<{ valid: boolean; message: string }> {
    return this.request("/v1/settings/test-storage", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async getAIInsights(params?: {
    project_id?: string;
    type?: string;
    show_dismissed?: boolean;
    limit?: number;
  }): Promise<AIInsight[]> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.type) query.set("type", params.type);
    if (params?.show_dismissed) query.set("show_dismissed", "true");
    if (params?.limit) query.set("limit", params.limit.toString());
    return this.request<AIInsight[]>(`/v1/ai/insights?${query}`);
  }

  async markInsightRead(insightId: string): Promise<void> {
    return this.request(`/v1/ai/insights/${insightId}/read`, { method: "POST" });
  }

  async dismissInsight(insightId: string): Promise<void> {
    return this.request(`/v1/ai/insights/${insightId}/dismiss`, { method: "POST" });
  }

  async generateInsights(projectId: string): Promise<{ insights_generated: number; insights: AIInsight[] }> {
    return this.request("/v1/ai/insights/generate", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId }),
    });
  }

  async runAIQuery(query: string, projectId: string): Promise<AIQueryResponse> {
    return this.request("/v1/ai/query", {
      method: "POST",
      body: JSON.stringify({ query, project_id: projectId }),
    });
  }

  async getAIQueryHistory(limit?: number): Promise<AIQuery[]> {
    const query = limit ? `?limit=${limit}` : "";
    return this.request<AIQuery[]>(`/v1/ai/query/history${query}`);
  }
}

export const api = new ApiClient();

export type {
  AuthResponse,
  User,
  Workspace,
  Project,
  Banner,
  Dashboard,
  EventsReportResponse,
  FunnelReportResponse,
  RetentionReportResponse,
  RawEvent,
  RawEventsResponse,
  SummaryResponse,
  WorkspaceSettings,
  AIInsight,
  AIQuery,
  AIQueryResponse,
};
