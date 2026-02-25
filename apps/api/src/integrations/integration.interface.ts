import { NormalizedResult } from '@company-intel/shared';

/**
 * All integration handlers must implement this interface.
 * testConnection() is called when the user clicks "Test" in the admin UI.
 * runEnrichment() is called during BullMQ job processing.
 */
export interface IIntegration {
  /** Verify credentials/connectivity. Throw on failure. */
  testConnection(): Promise<void>;

  /** Execute the enrichment query and return normalized results. */
  runEnrichment(query: string, options?: Record<string, unknown>): Promise<NormalizedResult>;
}
