# DocuNexa Frontend API Integration & Adapter Guide

**Target Environment:** Angular 19 Client -> Node.js REST API Gateway  
**Base URL:** `https://api.docunexa.enterprise/v1`

---

## 1. Adapter Architecture Overview

DocuNexa uses Angular **Abstract Dependency Injection Tokens** to decouple UI view components from backend implementation details:

```
[ Angular Standalone Components ]
              │
              ▼
    [ Service Injection Token ] (e.g., DOCUMENT_SERVICE_TOKEN)
        │                 │
        ├── Development ──► [ MockDocumentService ] (Simulated delays, offline demo)
        │
        └── Production  ──► [ HttpDocumentService ] (Live HttpClient, Node.js REST API)
```

---

## 2. HttpDocumentService Implementation Blueprint

When transitioning to production, instantiate `HttpDocumentService` in `src/app/core/services/http/http-document.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IDocumentService, IDocumentItem } from '../api-services';

@Injectable({ providedIn: 'root' })
export class HttpDocumentService implements IDocumentService {
  private http = inject(HttpClient);
  private baseUrl = 'https://api.docunexa.enterprise/v1/documents';

  getDocuments(params: any): Observable<{ data: IDocumentItem[]; total: number }> {
    let httpParams = new HttpParams();
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.page) httpParams = httpParams.set('page', params.page);

    return this.http.get<{ data: IDocumentItem[]; total: number }>(this.baseUrl, { params: httpParams });
  }

  uploadDocument(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/upload`, formData);
  }
}
```
