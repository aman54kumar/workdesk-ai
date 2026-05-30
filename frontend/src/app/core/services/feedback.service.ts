import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppFeedbackRequest {
  name: string;
  issue: string;
  email_or_phone?: string;
  page_url?: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private http = inject(HttpClient);

  submitAppFeedback(body: AppFeedbackRequest): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${environment.apiUrl}/feedback/app`, body);
  }
}
