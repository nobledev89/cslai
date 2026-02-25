import { Injectable } from '@nestjs/common';
import { IntegrationType } from '@company-intel/db';
import { IIntegration } from './integration.interface';
import { SlackIntegration } from './slack/slack.integration';
import { WooCommerceIntegration } from './woocommerce/woocommerce.integration';
import { GmailIntegration } from './gmail/gmail.integration';
import { CustomRestIntegration } from './custom-rest/custom-rest.integration';
import { TrackpodIntegration } from './trackpod/trackpod.integration';

/**
 * Maps IntegrationType enum → concrete integration handler instance.
 * Config is passed in at construction time (decrypted by caller).
 */
@Injectable()
export class RegistryService {
  build(type: IntegrationType, config: Record<string, unknown>): IIntegration {
    switch (type) {
      case 'SLACK':
        return new SlackIntegration(config as any);
      case 'WOOCOMMERCE':
        return new WooCommerceIntegration(config as any);
      case 'GMAIL':
        return new GmailIntegration(config as any);
      case 'CUSTOM_REST':
        return new CustomRestIntegration(config as any);
      case 'TRACKPOD':
        return new TrackpodIntegration(config as any);
      default:
        throw new Error(`Unknown integration type: ${type}`);
    }
  }
}
