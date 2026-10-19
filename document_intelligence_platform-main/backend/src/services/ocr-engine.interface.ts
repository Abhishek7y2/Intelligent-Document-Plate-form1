import { NormalizedOcrResult, OcrProcessInput } from '../models/ocr.models.js';

export interface OcrEngineAdapter {
  readonly name: string;
  readonly version: string;
  readonly isMock: boolean;

  /**
   * Checks whether the engine binary or runtime is available and healthy
   */
  isAvailable(): Promise<boolean>;

  /**
   * Executes OCR extraction on the input document
   */
  process(input: OcrProcessInput): Promise<NormalizedOcrResult>;
}
