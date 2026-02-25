import { Module } from '@nestjs/common';
import { SlackEventsController } from './slack-events.controller';
import { QueueModule } from '../../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [SlackEventsController],
})
export class SlackModule {}
