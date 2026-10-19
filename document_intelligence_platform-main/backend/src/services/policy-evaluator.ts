import {
  ProcessingPolicyRecord,
  PolicyRule,
  PolicyEvaluationResult,
  RuleEvaluationItem,
} from '../models/schema.models.js';
import { Logger } from '../utils/logger.js';
import { safeRegexMatch } from '../utils/schema-validator.js';

/**
 * Deterministic Policy Evaluation Engine.
 *
 * Security Invariants:
 * 1. Strictly avoids `eval`, `new Function()`, dynamic code compilation, or arbitrary SQL.
 * 2. Evaluates rules using pure, deterministic comparisons against structured extracted data.
 * 3. Does not coerce strings to numbers silently.
 * 4. Safe bounded regex execution prevents ReDoS attacks.
 * 5. Unknown operators and type mismatches fail safely.
 */
export class PolicyEvaluator {
  static evaluate(
    policy: ProcessingPolicyRecord,
    extractedData: Record<string, any>
  ): PolicyEvaluationResult {
    const ruleEvaluations: RuleEvaluationItem[] = [];
    let hasReject = false;
    let hasFlagReview = false;
    let hasExecutionError = false;

    // Guard against null/malformed policy
    if (!policy || !Array.isArray(policy.rules)) {
      return {
        policyId: policy?.policyId || 'unknown',
        policyName: policy?.name || 'Malformed Policy',
        status: 'FAILED',
        ruleEvaluations: [],
        summary: 'Policy evaluation failed: Malformed policy definition without valid rules.',
        evaluatedAt: new Date(),
      };
    }

    for (const rule of policy.rules) {
      if (!rule || !rule.ruleId || !rule.field || !rule.operator) {
        hasExecutionError = true;
        ruleEvaluations.push({
          ruleId: rule?.ruleId || 'malformed_rule',
          ruleName: rule?.name || 'Malformed Rule',
          matched: false,
          action: 'REJECT',
          message: 'Malformed rule definition.',
          error: 'Rule definition is missing mandatory fields (ruleId, field, operator).',
        });
        continue;
      }

      const fieldValue = extractedData ? extractedData[rule.field] : undefined;
      const evalResult = this.evaluateSingleRule(rule, fieldValue);

      ruleEvaluations.push({
        ruleId: rule.ruleId,
        ruleName: rule.name,
        matched: evalResult.matched,
        action: rule.action,
        message: evalResult.error
          ? `Rule evaluation failed: ${evalResult.error}`
          : evalResult.matched
          ? rule.message
          : `Rule ${rule.ruleId} passed.`,
        error: evalResult.error,
      });

      if (evalResult.error) {
        hasExecutionError = true;
      } else if (evalResult.matched) {
        if (rule.action === 'REJECT') {
          hasReject = true;
        } else if (rule.action === 'FLAG_REVIEW' || rule.action === 'REQUIRE_APPROVAL') {
          hasFlagReview = true;
        }
      }
    }

    let overallStatus: 'PASSED' | 'FAILED' | 'REQUIRES_REVIEW' | 'NOT_APPLICABLE' = 'PASSED';
    let summary = 'All policy validation checks passed.';

    // Safe failure: Policy execution errors or type mismatches fail safely
    if (hasExecutionError) {
      overallStatus = 'FAILED';
      summary = 'Policy evaluation failed due to rule execution errors or type mismatches.';
    } else if (hasReject) {
      overallStatus = 'FAILED';
      summary = 'Document policy evaluation failed due to critical rule violations.';
    } else if (hasFlagReview) {
      overallStatus = 'REQUIRES_REVIEW';
      summary = 'Document flagged for human reviewer or approver sign-off based on policy triggers.';
    }

    Logger.info({
      message: 'Policy evaluation completed',
      context: 'PolicyEvaluator',
      data: {
        policyId: policy.policyId,
        policyType: policy.policyType,
        overallStatus,
        totalRules: policy.rules.length,
        hasExecutionError,
      },
    });

    return {
      policyId: policy.policyId,
      policyName: policy.name,
      status: overallStatus,
      ruleEvaluations,
      summary,
      evaluatedAt: new Date(),
    };
  }

  private static evaluateSingleRule(
    rule: PolicyRule,
    actualValue: any
  ): { matched: boolean; error?: string } {
    const { operator, value: expectedValue } = rule;

    // 1. is_not_empty operator
    if (operator === 'is_not_empty') {
      const isPresent = actualValue !== undefined && actualValue !== null && String(actualValue).trim() !== '';
      return { matched: isPresent };
    }

    // 2. Missing or null actual values
    if (actualValue === undefined || actualValue === null) {
      if (operator === 'eq') {
        return { matched: expectedValue === null || expectedValue === undefined };
      }
      if (operator === 'neq') {
        return { matched: expectedValue !== null && expectedValue !== undefined };
      }
      // For all other comparison operators, missing value does not match
      return { matched: false };
    }

    // 3. Strict operators
    switch (operator) {
      case 'eq': {
        if (typeof actualValue === 'number' && typeof expectedValue === 'number') {
          return { matched: actualValue === expectedValue };
        }
        if (typeof actualValue === 'boolean' && typeof expectedValue === 'boolean') {
          return { matched: actualValue === expectedValue };
        }
        return { matched: String(actualValue).toLowerCase() === String(expectedValue).toLowerCase() };
      }

      case 'neq': {
        if (typeof actualValue === 'number' && typeof expectedValue === 'number') {
          return { matched: actualValue !== expectedValue };
        }
        if (typeof actualValue === 'boolean' && typeof expectedValue === 'boolean') {
          return { matched: actualValue !== expectedValue };
        }
        return { matched: String(actualValue).toLowerCase() !== String(expectedValue).toLowerCase() };
      }

      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte': {
        // Enforce: Numeric comparisons do not silently compare strings as numbers.
        const isActualNumber = typeof actualValue === 'number' && !isNaN(actualValue);
        const isExpectedNumber = typeof expectedValue === 'number' && !isNaN(expectedValue);

        if (isActualNumber && isExpectedNumber) {
          if (operator === 'gt') return { matched: actualValue > expectedValue };
          if (operator === 'gte') return { matched: actualValue >= expectedValue };
          if (operator === 'lt') return { matched: actualValue < expectedValue };
          if (operator === 'lte') return { matched: actualValue <= expectedValue };
        }

        // Strict Date comparisons if both are ISO dates or Date instances
        const isActualDate = actualValue instanceof Date || (typeof actualValue === 'string' && !isNaN(Date.parse(actualValue)));
        const isExpectedDate = expectedValue instanceof Date || (typeof expectedValue === 'string' && !isNaN(Date.parse(expectedValue)));

        if (isActualDate && isExpectedDate && typeof actualValue !== 'number' && typeof expectedValue !== 'number') {
          const actTime = new Date(actualValue).getTime();
          const expTime = new Date(expectedValue).getTime();
          if (operator === 'gt') return { matched: actTime > expTime };
          if (operator === 'gte') return { matched: actTime >= expTime };
          if (operator === 'lt') return { matched: actTime < expTime };
          if (operator === 'lte') return { matched: actTime <= expTime };
        }

        // Strict type mismatch error
        return {
          matched: false,
          error: `Type mismatch: operator '${operator}' requires numeric or date operands, received actual '${typeof actualValue}' and expected '${typeof expectedValue}'.`,
        };
      }

      case 'contains': {
        if (Array.isArray(actualValue)) {
          return { matched: actualValue.includes(expectedValue) };
        }
        if (typeof actualValue === 'string') {
          return { matched: actualValue.toLowerCase().includes(String(expectedValue).toLowerCase()) };
        }
        return {
          matched: false,
          error: `Type mismatch: 'contains' requires string or array actual value, received '${typeof actualValue}'.`,
        };
      }

      case 'in': {
        if (!Array.isArray(expectedValue)) {
          return {
            matched: false,
            error: `Type mismatch: 'in' operator requires array target value, received '${typeof expectedValue}'.`,
          };
        }
        return {
          matched: expectedValue.map((v) => String(v).toLowerCase()).includes(String(actualValue).toLowerCase()),
        };
      }

      case 'regex_match': {
        if (typeof actualValue !== 'string' && typeof actualValue !== 'number') {
          return {
            matched: false,
            error: `Type mismatch: 'regex_match' requires string or number actual value, received '${typeof actualValue}'.`,
          };
        }
        const matchResult = safeRegexMatch(String(expectedValue), String(actualValue));
        return {
          matched: matchResult.matched,
          error: matchResult.error,
        };
      }

      default: {
        return {
          matched: false,
          error: `Unknown or unsupported policy operator '${operator}'.`,
        };
      }
    }
  }
}
