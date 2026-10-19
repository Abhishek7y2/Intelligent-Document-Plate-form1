import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';

export interface UserInvitation {
  id: string;
  email: string;
  role: string;
  invitedBy?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  inviteToken?: string; // Only populated once on creation
}

export interface ExportMaskingRule {
  id: string;
  documentType: string;
  fieldKey: string;
  maskingType: 'REDACT' | 'HASH' | 'PARTIAL' | 'EXCLUDE';
  description?: string;
  active: boolean;
}

export interface ExportJobItem {
  id: string;
  reportType: string;
  format: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVOKED';
  downloadUrl?: string;
  createdAt: string;
  revokedAt?: string;
}

export interface IntakeMailbox {
  id: string;
  name?: string;
  emailAddress?: string;
  address?: string;
  host?: string;
  port?: number;
  useSsl?: boolean;
  targetDocumentType?: string;
  allowedSenderDomains?: string[];
  active?: boolean;
  isActive?: boolean;
  defaultUploaderUserId?: string;
}

export interface TraceTimelineEvent {
  id: string;
  timestamp: string;
  source: 'AUDIT' | 'OUTBOX' | 'ATTEMPT';
  type: string;
  status: string;
  details: any;
  correlationId: string;
}

@Injectable({
  providedIn: 'root',
})
export class HttpAdminService {
  private api = inject(ApiClient);

  // Roles & Permissions (Part 0.1)
  getRoles(): Observable<{ roles: string[]; overrideRoles: string[]; rolesDetails: any[] }> {
    return this.api.get<any>('/roles').pipe(
      map((res) => ({
        roles: res?.roles || [
          'Admin',
          'Reviewer',
          'Analyst',
          'Auditor',
          'contributor',
          'approver',
          'platform_operator',
        ],
        overrideRoles: res?.overrideRoles || ['Admin', 'approver'],
        rolesDetails: res?.rolesDetails || [],
      })),
      catchError(() =>
        of({
          roles: [
            'Admin',
            'Reviewer',
            'Analyst',
            'Auditor',
            'contributor',
            'approver',
            'platform_operator',
          ],
          overrideRoles: ['Admin', 'approver'],
          rolesDetails: [],
        })
      )
    );
  }

  // User Management & Role Changes (Part D.1)
  updateUserRole(userId: string, role: string): Observable<{ success: boolean; message: string }> {
    return this.api.patch<any>(`/users/${userId}/role`, { role }).pipe(
      map((res) => ({ success: true, message: res?.message || 'User role updated and sessions revoked.' }))
    );
  }

  inviteUser(email: string, role: string, fullName?: string): Observable<{ success: boolean; invitation: UserInvitation; inviteToken?: string }> {
    return this.api.post<any>('/users/invite', { email, role, fullName }).pipe(
      map((res) => ({
        success: true,
        invitation: res?.invitation || res,
        inviteToken: res?.token || res?.inviteToken,
      }))
    );
  }

  listPendingInvitations(): Observable<UserInvitation[]> {
    return this.api.get<any>('/users/invitations').pipe(
      map((res) => {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.invitations)) return res.invitations;
        if (Array.isArray(res?.data)) return res.data;
        return [];
      }),
      catchError((err) => {
        console.warn('[HttpAdminService] Failed to fetch invitations:', err);
        return of([]);
      })
    );
  }

  revokeInvitation(id: string): Observable<boolean> {
    return this.api.delete<any>(`/users/invitations/${id}`).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  // Export Masking Rules & Exports (Part G.1)
  listExportMaskingRules(): Observable<ExportMaskingRule[]> {
    return this.api.get<any>('/admin/export-masking-rules').pipe(
      map((res) => {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.rules)) return res.rules;
        if (Array.isArray(res?.data)) return res.data;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  createExportMaskingRule(rule: Partial<ExportMaskingRule>): Observable<ExportMaskingRule> {
    return this.api.post<any>('/admin/export-masking-rules', rule);
  }

  updateExportMaskingRule(id: string, rule: Partial<ExportMaskingRule>): Observable<ExportMaskingRule> {
    return this.api.put<any>(`/admin/export-masking-rules/${id}`, rule);
  }

  deleteExportMaskingRule(id: string): Observable<boolean> {
    return this.api.delete<any>(`/admin/export-masking-rules/${id}`).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  listExports(): Observable<ExportJobItem[]> {
    return this.api.get<any>('/exports').pipe(
      map((res) => {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.exports)) return res.exports;
        if (Array.isArray(res?.data)) return res.data;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  revokeExport(id: string): Observable<boolean> {
    return this.api.post<any>(`/exports/${id}/revoke`, {}).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  // Intake Mailboxes (Part G.2)
  listMailboxes(): Observable<IntakeMailbox[]> {
    return this.api.get<any>('/admin/intake-mailboxes').pipe(
      map((res) => {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.mailboxes)) return res.mailboxes;
        if (Array.isArray(res?.data)) return res.data;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  createMailbox(payload: Partial<IntakeMailbox>): Observable<IntakeMailbox> {
    return this.api.post<any>('/admin/intake-mailboxes', payload);
  }

  updateMailbox(id: string, payload: Partial<IntakeMailbox>): Observable<IntakeMailbox> {
    return this.api.patch<any>(`/admin/intake-mailboxes/${id}`, payload);
  }

  // Trace Timeline (Part G.3)
  getTraceTimeline(correlationId: string): Observable<{
    correlationId: string;
    auditEvents: any[];
    outboxEvents: any[];
    processingAttempts: any[];
    timeline: TraceTimelineEvent[];
  }> {
    return this.api.get<any>('/admin/trace', { correlationId }).pipe(
      map((res) => {
        const auditEvents = res?.auditEvents || [];
        const outboxEvents = res?.outboxEvents || [];
        const processingAttempts = res?.processingAttempts || [];

        const timeline: TraceTimelineEvent[] = [
          ...auditEvents.map((a: any) => ({
            id: a.eventId || a.id || `AUD-${Math.random()}`,
            timestamp: a.createdAt || new Date().toISOString(),
            source: 'AUDIT' as const,
            type: a.action || 'AUDIT_RECORD',
            status: 'RECORDED',
            details: a.details || a,
            correlationId,
          })),
          ...outboxEvents.map((o: any) => ({
            id: o.eventId || o.id || `OUT-${Math.random()}`,
            timestamp: o.createdAt || new Date().toISOString(),
            source: 'OUTBOX' as const,
            type: o.eventType || 'OUTBOX_EVENT',
            status: o.status || 'PENDING',
            details: o.payload || o,
            correlationId,
          })),
          ...processingAttempts.map((p: any) => ({
            id: p.id || `ATT-${Math.random()}`,
            timestamp: p.createdAt || new Date().toISOString(),
            source: 'ATTEMPT' as const,
            type: `PIPELINE_STAGE_${p.stage || 'EXEC'}`,
            status: p.succeeded ? 'SUCCEEDED' : 'FAILED',
            details: p.error || { stage: p.stage, attemptNumber: p.attemptNumber },
            correlationId,
          })),
        ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return {
          correlationId: res?.correlationId || correlationId,
          auditEvents,
          outboxEvents,
          processingAttempts,
          timeline,
        };
      }),
      catchError((err) => {
        console.warn(`[HttpAdminService] Failed to fetch trace for ${correlationId}:`, err);
        return of({ correlationId, auditEvents: [], outboxEvents: [], processingAttempts: [], timeline: [] });
      })
    );
  }

  // Document Type Publish (Part G.5)
  publishDocumentTypeTemplate(typeId: string, version: string): Observable<any> {
    return this.api.post<any>(`/document-types/${typeId}/templates/${version}/publish`, {});
  }

  // AI Quality Golden Set Evaluation (Sprint 8 Part E / AI-008)
  triggerAiEvaluationRun(analysisVersion = '1.2.0', modelVersion = 'gemini-1.5-pro / tesseract-v5.5'): Observable<any> {
    return this.api.post<any>('/admin/ai-quality/run', { analysisVersion, modelVersion });
  }

  getAiEvaluationRuns(): Observable<any> {
    return this.api.get<any>('/admin/ai-quality/runs');
  }
}
