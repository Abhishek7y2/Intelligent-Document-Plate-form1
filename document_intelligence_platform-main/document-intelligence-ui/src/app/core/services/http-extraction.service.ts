import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';
import { IExtractionService, IExtractionField } from './api-services';

@Injectable({
  providedIn: 'root',
})
export class HttpExtractionService implements IExtractionService {
  private readonly api = inject(ApiClient);

  getExtractedFields(docId: string): Observable<IExtractionField[]> {
    return this.api.get<any>(`/review/${docId}`).pipe(
      map((data) => {
        if (!data || !data.fields) return [];
        return data.fields.map((f: any) => ({
          key: f.key || f.fieldName,
          label: f.label || f.fieldName,
          value: f.value ?? f.extractedValue,
          confidence: f.confidence ?? 90,
          bbox: f.bbox,
          flagged: f.status === 'LOW_CONFIDENCE' || f.confidence < 85,
        }));
      })
    );
  }

  updateField(docId: string, key: string, value: any): Observable<boolean> {
    return this.api
      .post<any>(`/review/${docId}/fields/${key}`, {
        correctedValue: value,
        reason: 'Updated via extraction service',
      })
      .pipe(map((res) => (res && res.success !== undefined ? res.success : true)));
  }
}
