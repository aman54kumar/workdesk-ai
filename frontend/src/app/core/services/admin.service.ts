import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminTask {
  task_type: string;
  display_name: string;
  description: string;
  section: string;
  path: string;
  icon: string;
  is_active: boolean;
  model_override: string | null;
  default_model: string;
}

export interface AllowedModels {
  models: string[];
  tiers: Record<string, string>;
}

export interface OrgLlmSettings {
  local_backend: string;
  local_base_url: string;
  local_api_key_set: boolean;
  model_default: string;
  model_code: string;
  model_quality: string;
  allowed_models: string[];
  allow_user_cloud: boolean;
  allowed_cloud_providers: string[];
  org_display_name: string;
  tier_models: Record<string, string>;
  cloud_refresh_openai_key_set?: boolean;
  cloud_refresh_anthropic_key_set?: boolean;
  cloud_refresh_google_key_set?: boolean;
  cloud_presets_refreshed_at?: string | null;
}

export interface CompanyProfileSection {
  id: number;
  key: string;
  label: string;
  content: string;
  enabled: boolean;
  sort_order: number;
}

export interface PromptTemplate {
  task_type: string;
  system: string;
  user_template: string;
  use_company_profile: boolean;
  is_overridden: boolean;
  updated_at: string | null;
}

export interface AdminDateBounds {
  min_date: string;
  max_date: string;
}

export interface AnalyticsSummary {
  total_requests: number;
  cache_hit_rate: number;
  avg_latency_ms: number;
}

export interface AnalyticsToolRow {
  task_type: string;
  usage_count: number;
  cache_hit_rate: number;
  avg_latency_ms: number;
  errors: number;
  timeouts: number;
  cancelled: number;
  thumbs_up: number;
  thumbs_down: number;
}

export interface FeedbackComment {
  id: number;
  task_type: string;
  model: string;
  rating: string;
  comment: string;
  created_at: string;
}

export interface AppFeedback {
  id: number;
  name: string;
  email_or_phone: string | null;
  issue: string;
  page_url: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const TOKEN_KEY = 'workdesk_admin_token';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private tokenSignal = signal<string | null>(this.readToken());

  readonly isLoggedIn = () => !!this.tokenSignal();

  login(username: string, password: string): Observable<{ access_token: string }> {
    return this.http
      .post<{ access_token: string }>(`${environment.apiUrl}/admin/login`, {
        username,
        password,
      })
      .pipe(
        tap((res) => {
          sessionStorage.setItem(TOKEN_KEY, res.access_token);
          this.tokenSignal.set(res.access_token);
        }),
      );
  }

  logout(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    this.tokenSignal.set(null);
  }

  getTasks(): Observable<AdminTask[]> {
    return this.http.get<AdminTask[]>(`${environment.apiUrl}/admin/tasks`, {
      headers: this.authHeaders(),
    });
  }

  getModels(): Observable<AllowedModels> {
    return this.http.get<AllowedModels>(`${environment.apiUrl}/admin/models`, {
      headers: this.authHeaders(),
    });
  }

  getLlmSettings(): Observable<OrgLlmSettings> {
    return this.http.get<OrgLlmSettings>(`${environment.apiUrl}/admin/llm-settings`, {
      headers: this.authHeaders(),
    });
  }

  saveLlmSettings(body: Record<string, unknown>): Observable<OrgLlmSettings> {
    return this.http.put<OrgLlmSettings>(
      `${environment.apiUrl}/admin/llm-settings`,
      body,
      { headers: this.authHeaders() },
    );
  }

  refreshLlmModels(): Observable<{ models: string[] }> {
    return this.http.post<{ models: string[] }>(
      `${environment.apiUrl}/admin/llm-settings/refresh-models`,
      {},
      { headers: this.authHeaders() },
    );
  }

  testLlmConnection(): Observable<{ ok: boolean; model_count?: number; error?: string }> {
    return this.http.post<{ ok: boolean; model_count?: number; error?: string }>(
      `${environment.apiUrl}/admin/llm-settings/test`,
      {},
      { headers: this.authHeaders() },
    );
  }

  refreshCloudPresets(): Observable<{
    ok: boolean;
    skipped?: boolean;
    reason?: string;
    refreshed_providers?: string[];
    errors?: Record<string, string>;
    refreshed_at?: string;
  }> {
    return this.http.post<{
      ok: boolean;
      skipped?: boolean;
      reason?: string;
      refreshed_providers?: string[];
      errors?: Record<string, string>;
      refreshed_at?: string;
    }>(
      `${environment.apiUrl}/admin/llm-settings/refresh-cloud-presets`,
      {},
      { headers: this.authHeaders() },
    );
  }

  updateTask(
    taskType: string,
    patch: { is_active?: boolean; model_override?: string | null },
  ): Observable<AdminTask> {
    return this.http.patch<AdminTask>(
      `${environment.apiUrl}/admin/tasks/${taskType}`,
      patch,
      { headers: this.authHeaders() },
    );
  }

  getCompanyProfile(): Observable<CompanyProfileSection[]> {
    return this.http.get<CompanyProfileSection[]>(
      `${environment.apiUrl}/admin/company-profile`,
      { headers: this.authHeaders() },
    );
  }

  saveCompanyProfile(sections: Partial<CompanyProfileSection>[]): Observable<CompanyProfileSection[]> {
    return this.http.put<CompanyProfileSection[]>(
      `${environment.apiUrl}/admin/company-profile`,
      { sections },
      { headers: this.authHeaders() },
    );
  }

  deleteCompanySection(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/admin/company-profile/${id}`,
      { headers: this.authHeaders() },
    );
  }

  getPrompts(): Observable<PromptTemplate[]> {
    return this.http.get<PromptTemplate[]>(`${environment.apiUrl}/admin/prompts`, {
      headers: this.authHeaders(),
    });
  }

  getPrompt(taskType: string): Observable<PromptTemplate> {
    return this.http.get<PromptTemplate>(
      `${environment.apiUrl}/admin/prompts/${taskType}`,
      { headers: this.authHeaders() },
    );
  }

  savePrompt(taskType: string, body: Omit<PromptTemplate, 'task_type' | 'is_overridden' | 'updated_at'>): Observable<PromptTemplate> {
    return this.http.put<PromptTemplate>(
      `${environment.apiUrl}/admin/prompts/${taskType}`,
      body,
      { headers: this.authHeaders() },
    );
  }

  resetPrompt(taskType: string): Observable<PromptTemplate> {
    return this.http.delete<PromptTemplate>(
      `${environment.apiUrl}/admin/prompts/${taskType}`,
      { headers: this.authHeaders() },
    );
  }

  getDateBounds(): Observable<AdminDateBounds> {
    return this.http.get<AdminDateBounds>(`${environment.apiUrl}/admin/date-bounds`, {
      headers: this.authHeaders(),
    });
  }

  getAnalyticsSummary(since?: string, until?: string): Observable<AnalyticsSummary> {
    const params = this.rangeParams(since, until);
    return this.http.get<AnalyticsSummary>(
      `${environment.apiUrl}/admin/analytics/summary`,
      { headers: this.authHeaders(), params },
    );
  }

  getAnalyticsTools(since?: string, until?: string): Observable<AnalyticsToolRow[]> {
    const params = this.rangeParams(since, until);
    return this.http.get<AnalyticsToolRow[]>(
      `${environment.apiUrl}/admin/analytics/tools`,
      { headers: this.authHeaders(), params },
    );
  }

  getAnalyticsComments(since?: string, until?: string): Observable<FeedbackComment[]> {
    const params = this.rangeParams(since, until);
    return this.http.get<FeedbackComment[]>(
      `${environment.apiUrl}/admin/analytics/comments`,
      { headers: this.authHeaders(), params },
    );
  }

  getAppFeedback(since?: string, until?: string): Observable<AppFeedback[]> {
    const params = this.rangeParams(since, until);
    return this.http.get<AppFeedback[]>(
      `${environment.apiUrl}/admin/feedback`,
      { headers: this.authHeaders(), params },
    );
  }

  private rangeParams(since?: string, until?: string): Record<string, string> {
    const p: Record<string, string> = {};
    if (since) p['since'] = since;
    if (until) p['until'] = until;
    return p;
  }

  private authHeaders(): HttpHeaders {
    const token = this.tokenSignal();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  private readToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }
}
