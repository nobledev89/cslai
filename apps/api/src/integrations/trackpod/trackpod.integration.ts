import { IIntegration } from '../integration.interface';
import { NormalizedResult, TrackpodConfig, okResult } from '@company-intel/shared';

/**
 * Trackpod integration — feature-flagged stub.
 * Returns empty results until endpoints are confirmed.
 */
export class TrackpodIntegration implements IIntegration {
  constructor(private readonly config: TrackpodConfig) {}

  async testConnection(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('Trackpod integration is disabled');
    }
    // Stub — no live endpoint confirmed yet
    return;
  }

  async runEnrichment(_query: string): Promise<NormalizedResult> {
    // Feature-flagged: return empty until implementation is complete
    if (!this.config.enabled) {
      return okResult('TRACKPOD', []);
    }
    // TODO: implement when Trackpod API endpoints are confirmed
    return okResult('TRACKPOD', []);
  }
}
