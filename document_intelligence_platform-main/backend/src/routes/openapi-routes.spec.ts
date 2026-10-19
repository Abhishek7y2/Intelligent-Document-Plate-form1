import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { apiRouter } from './api.routes.js';

describe('OpenAPI 3.1 Spec Route Coverage Test (Part A / FR-023)', () => {
  let expressRoutes: Set<string>;
  let openApiPaths: Set<string>;

  beforeAll(() => {
    // 1. Extract all routes from Express apiRouter
    expressRoutes = new Set<string>();

    for (const layer of (apiRouter as any).stack) {
      if (layer.route && layer.route.path) {
        const expressPath: string = layer.route.path;
        // Normalize express route parameters: :param -> {param}
        const normalizedPath = expressPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
        expressRoutes.add(normalizedPath);
      }
    }

    // 2. Load openapi.yaml
    const openApiFile = path.resolve(process.cwd(), 'openapi.yaml');
    expect(fs.existsSync(openApiFile)).toBe(true);

    const content = fs.readFileSync(openApiFile, 'utf8');
    const doc = yaml.parse(content);
    expect(doc.openapi).toMatch(/^3\.1/);

    openApiPaths = new Set<string>(Object.keys(doc.paths || {}));
  });

  it('fails if any Express route is missing from openapi.yaml', () => {
    const missingInSpec: string[] = [];
    for (const route of expressRoutes) {
      if (!openApiPaths.has(route)) {
        missingInSpec.push(route);
      }
    }

    expect(missingInSpec).toEqual([]);
  });

  it('fails if any openapi.yaml path does not exist in the Express route table', () => {
    const extraneousInSpec: string[] = [];
    for (const specPath of openApiPaths) {
      if (!expressRoutes.has(specPath)) {
        extraneousInSpec.push(specPath);
      }
    }

    expect(extraneousInSpec).toEqual([]);
  });

  it('verifies essential OpenAPI 3.1 elements are defined', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'openapi.yaml'), 'utf8');
    const doc = yaml.parse(content);

    // Bearer auth component
    expect(doc.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(doc.components.securitySchemes.bearerAuth.type).toBe('http');
    expect(doc.components.securitySchemes.bearerAuth.scheme).toBe('bearer');

    // Idempotency-Key header component
    expect(doc.components?.parameters?.IdempotencyKeyHeader).toBeDefined();

    // Problem details error schema
    expect(doc.components?.schemas?.ErrorResponse).toBeDefined();
    expect(doc.components?.schemas?.AcceptedAsyncResponse).toBeDefined();
  });

  it('fails when the frontend calls an endpoint that is not in openapi.yaml (parse frontend api services)', () => {
    const frontendServicesDir = path.resolve(process.cwd(), '../document-intelligence-ui/src/app/core/services');
    if (!fs.existsSync(frontendServicesDir)) {
      return;
    }

    const serviceFiles = fs.readdirSync(frontendServicesDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
    const calledPaths = new Set<string>();

    for (const file of serviceFiles) {
      const code = fs.readFileSync(path.join(frontendServicesDir, file), 'utf8');
      const matches = code.matchAll(/\bthis\.api\.(?:get|post|put|patch|delete)(?:<[^>]+>)?\(\s*[`'"]([^`'"]+)[`'"]/g);
      for (const m of matches) {
        let route = m[1];
        route = route.replace(/\$\{typeId\}/g, '{typeId}')
                     .replace(/\$\{version\}/g, '{version}')
                     .replace(/\$\{traceId\}/g, '{traceId}')
                     .replace(/\$\{pageNo\}/g, '{pageNo}')
                     .replace(/\$\{summaryId\}/g, '{summaryId}')
                     .replace(/\$\{key\}/g, '{key}')
                     .replace(/\$\{[^}]+\}/g, '{id}');
        if (route.includes('/pages/{id}/image')) route = route.replace('/pages/{id}/image', '/pages/{pageNo}/image');
        if (route.includes('/templates/{id}/publish')) route = route.replace('/templates/{id}/publish', '/templates/{version}/publish');
        if (route.includes('/summary/{id}')) route = route.replace('/summary/{id}', '/summary/{summaryId}');
        if (route.includes('/fields/{id}')) route = route.replace('/fields/{id}', '/fields/{key}');
        calledPaths.add(route);
      }
    }

    const missingInOpenApi: string[] = [];
    for (const p of calledPaths) {
      // Map potential alias variations
      if (!openApiPaths.has(p)) {
        missingInOpenApi.push(p);
      }
    }

    expect(missingInOpenApi).toEqual([]);
  });
});

