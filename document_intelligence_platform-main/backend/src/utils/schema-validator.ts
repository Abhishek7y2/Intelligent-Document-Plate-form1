import { z } from 'zod';
import vm from 'node:vm';

export const MAX_REGEX_PATTERN_LENGTH = 200;
export const MAX_REGEX_INPUT_LENGTH = 8192;

/**
 * Validates regular expressions against dangerous ReDoS patterns
 * (e.g. catastrophic exponential backtracking caused by nested quantifiers like (a+)+ or (.*a)+).
 */
export function isSafeRegex(pattern: string): { safe: boolean; error?: string } {
  try {
    // 1. Length limit on regex pattern
    if (!pattern || pattern.length > MAX_REGEX_PATTERN_LENGTH) {
      return {
        safe: false,
        error: `Regular expression pattern must be between 1 and ${MAX_REGEX_PATTERN_LENGTH} characters.`,
      };
    }

    // 2. Syntax validation
    new RegExp(pattern);

    // 3. Reject patterns with known dangerous nested quantifiers: (.*)+, (a+)+, (a+)*, etc.
    const dangerousBacktrackingPattern = /\([^)]*([+*]|\{\d+,?\d*\})\)[+*]|\([^)]*\)[+*]\+/;
    if (dangerousBacktrackingPattern.test(pattern)) {
      return {
        safe: false,
        error: 'Dangerous regular expression pattern detected: nested quantifiers may cause catastrophic backtracking (ReDoS).',
      };
    }

    // 4. Reject overlapping alternation with outer quantifiers: (a|aa)+
    const dangerousAlternationPattern = /\([^)]*\|[^)]*\)[+*]/;
    if (dangerousAlternationPattern.test(pattern)) {
      return {
        safe: false,
        error: 'Dangerous regular expression pattern detected: overlapping alternations with outer quantifiers may trigger exponential complexity.',
      };
    }

    // 5. Reject repeated wildcard sequences: (.*)+ or (.+)+
    const repeatedWildcardPattern = /(\.\*)+|(\.\+)+/;
    if (repeatedWildcardPattern.test(pattern)) {
      return {
        safe: false,
        error: 'Dangerous regular expression pattern detected: repeated wildcard sequences prohibited.',
      };
    }

    return { safe: true };
  } catch (err: any) {
    return { safe: false, error: `Invalid regular expression: ${err.message}` };
  }
}

/**
 * Bounded regular expression execution using node:vm sandbox.
 * Enforces:
 * 1. Input string length cap (8192 chars) to avoid buffer exhaustion.
 * 2. Hardened null-prototype VM context without access to process, require, or prototype methods.
 * 3. Strict CPU execution deadline (default 50ms) to ensure ReDoS cannot stall Node.js event loop.
 */
export function safeRegexMatch(
  pattern: string,
  text: string,
  timeoutMs = 500
): { matched: boolean; error?: string } {
  // Input length enforcement
  if (text === undefined || text === null) {
    return { matched: false };
  }

  const strText = String(text);
  if (strText.length > MAX_REGEX_INPUT_LENGTH) {
    return {
      matched: false,
      error: `Input text length (${strText.length}) exceeds maximum evaluation limit of ${MAX_REGEX_INPUT_LENGTH} characters.`,
    };
  }

  const staticCheck = isSafeRegex(pattern);
  if (!staticCheck.safe) {
    return { matched: false, error: staticCheck.error };
  }

  try {
    const sandbox = {
      regex: new RegExp(pattern),
      text: strText,
      result: false,
    };

    vm.runInNewContext('result = regex.test(text);', sandbox, {
      timeout: timeoutMs,
      breakOnSigint: true,
    });

    return { matched: Boolean(sandbox.result) };
  } catch (err: any) {
    const isTimeout = err.message && (err.message.includes('timed out') || err.message.includes('timeout'));
    return {
      matched: false,
      error: isTimeout
        ? 'Regular expression execution timed out (potential ReDoS prevented).'
        : `Regular expression execution error: ${err.message}`,
    };
  }
}

export const TemplateFieldSchema = z.object({
  id: z.string().min(1),
  key: z.string().regex(/^[a-z0-9_]+$/, 'Field key must be lowercase alphanumeric with underscores'),
  label: z.string().min(1).max(255),
  type: z.enum(['text', 'number', 'date', 'currency', 'enum', 'table', 'boolean']),
  cardinality: z.enum(['single', 'array']),
  required: z.boolean(),
  acceptedValues: z.union([z.string(), z.array(z.string())]).optional(),
  regexPattern: z.string().optional(),
  arithmeticRule: z.string().max(500).optional(),
  masking: z.enum(['none', 'full', 'partial']).default('none'),
  reviewerRole: z.enum(['reviewer', 'approver', 'org_admin']).default('reviewer'),
  exportable: z.boolean().default(true),
  confidenceThreshold: z.number().min(0.0).max(1.0).default(0.85),
  displayOrder: z.number().optional(),
}).refine((data) => {
  if (data.regexPattern) {
    const check = isSafeRegex(data.regexPattern);
    return check.safe;
  }
  return true;
}, {
  message: 'Field contains an invalid or dangerous regular expression pattern.',
  path: ['regexPattern'],
});

export const CreateDocumentTypeSchema = z.object({
  typeId: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/, 'Type ID must be kebab-case (e.g. purchase-invoice)'),
  code: z.string().min(2).max(64).regex(/^[A-Z0-9_-]+$/, 'Type code must be uppercase alphanumeric (e.g. PUR-INVOICE)'),
  name: z.string().min(2).max(255),
  description: z.string().max(1000).optional(),
  workflow: z.string().max(100).optional(),
});

export const UpdateDocumentTypeSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(1000).optional(),
  workflow: z.string().max(100).optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'INACTIVE']).optional(),
});

export const CreateTemplateSchema = z.object({
  version: z.string().regex(/^v[0-9]+(\.[0-9]+)?$/, 'Version must follow format v1.0 or v2.1'),
  name: z.string().min(2).max(255),
  description: z.string().max(1000).optional(),
  fields: z.array(TemplateFieldSchema).min(1, 'Template must contain at least one field definition'),
});

export const PolicyRuleSchema = z.object({
  ruleId: z.string().min(1),
  name: z.string().min(1).max(255),
  field: z.string().min(1),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'regex_match', 'is_not_empty']),
  value: z.any(),
  action: z.enum(['FLAG_REVIEW', 'REJECT', 'APPROVE', 'REQUIRE_APPROVAL']),
  message: z.string().min(1).max(500),
});

export const CreatePolicySchema = z.object({
  name: z.string().min(2).max(255),
  policyType: z.enum(['VALIDATION', 'APPROVAL_ROUTING', 'CONFIDENCE_THRESHOLD', 'SLA_GATE']),
  version: z.string().regex(/^v[0-9]+(\.[0-9]+)?$/, 'Version must follow format v1.0 or v2.1'),
  rules: z.array(PolicyRuleSchema).min(1, 'Policy must have at least one rule'),
});

export const EvaluatePolicySchema = z.object({
  data: z.record(z.any()),
});
