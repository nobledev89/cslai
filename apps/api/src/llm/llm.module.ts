import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
