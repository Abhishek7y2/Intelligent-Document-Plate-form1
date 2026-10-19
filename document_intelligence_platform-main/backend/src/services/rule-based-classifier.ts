import { NormalizedOcrResult } from '../models/ocr.models.js';
import { ClassificationRoutingDecision } from '../models/extraction.models.js';

export interface ClassifierOutput {
  predictedType: string;
  confidenceScore: number;
  isConfident: boolean;
  routingDecision: ClassificationRoutingDecision;
  classifierName: string;
  matchingSignals: string[];
}

export interface DocumentClassifier {
  classify(ocrResult: NormalizedOcrResult): Promise<ClassifierOutput>;
}

export class RuleBasedClassifier implements DocumentClassifier {
  readonly name = 'DocuNexa-RuleClassifier-v1';

  private readonly invoiceKeywords = [
    'tax invoice',
    'invoice',
    'bill to',
    'ship to',
    'gstin',
    'total due',
    'amount due',
    'subtotal',
    'item description',
    'purchase order',
    'inv-',
  ];

  private readonly contractKeywords = [
    'agreement',
    'contract',
    'master services',
    'between the parties',
    'terms and conditions',
    'governing law',
    'confidentiality',
    'indemnification',
    'effective date',
    'termination',
    'in witness whereof',
  ];

  private readonly policyKeywords = [
    'policy',
    'governance',
    'procedure',
    'compliance',
    'standard operating procedure',
    'information security',
    'document control',
    'version control',
    'guideline',
    'code of conduct',
  ];

  async classify(ocrResult: NormalizedOcrResult): Promise<ClassifierOutput> {
    const text = (ocrResult.fullText || '').toLowerCase();

    const invoiceMatches = this.findMatches(text, this.invoiceKeywords);
    const contractMatches = this.findMatches(text, this.contractKeywords);
    const policyMatches = this.findMatches(text, this.policyKeywords);

    const scores = [
      { type: 'purchase-invoice', matches: invoiceMatches, weight: 1.0 },
      { type: 'supplier-contract', matches: contractMatches, weight: 1.0 },
      { type: 'internal-policy', matches: policyMatches, weight: 1.0 },
    ];

    scores.sort((a, b) => b.matches.length - a.matches.length);
    const best = scores[0];

    if (!best || best.matches.length === 0) {
      return {
        predictedType: 'unknown',
        confidenceScore: 0.15,
        isConfident: false,
        routingDecision: 'MANUAL_TRIAGE',
        classifierName: this.name,
        matchingSignals: [],
      };
    }

    // Baseline confidence based on signal density
    // 1 match = 0.65, 2 matches = 0.82, 3+ matches = 0.95
    let confidence = 0.5 + Math.min(best.matches.length * 0.16, 0.45);
    confidence = Math.min(1.0, Math.max(0.0, parseFloat(confidence.toFixed(4))));

    // FR-004: If classification confidence < 80%, route to manual triage queue
    const isConfident = confidence >= 0.8;
    const routingDecision: ClassificationRoutingDecision = isConfident ? 'AUTO_CLASSIFIED' : 'MANUAL_TRIAGE';

    return {
      predictedType: best.type,
      confidenceScore: confidence,
      isConfident,
      routingDecision,
      classifierName: this.name,
      matchingSignals: best.matches,
    };
  }

  private findMatches(text: string, keywords: string[]): string[] {
    const matches: string[] = [];
    for (const kw of keywords) {
      if (text.includes(kw)) {
        matches.push(kw);
      }
    }
    return matches;
  }
}
