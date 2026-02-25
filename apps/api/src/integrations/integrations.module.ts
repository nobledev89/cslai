import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { RegistryService } from './registry.service';
import { SlackModule } from './slack/slack.module';

@Module({
  imports: [SlackModule],
  providers: [IntegrationsService, RegistryService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService, RegistryService],
})
export class IntegrationsModule {}
