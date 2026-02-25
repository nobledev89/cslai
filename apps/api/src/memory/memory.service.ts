// =============================================================================
// Memory Service — thread memory read/append/summarize
// =============================================================================

import { Injectable } from '@nestjs/common';
import { prisma } from '@company-intel/db';
import type { Prisma } from '@company-intel/db';

interface MemoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts?: string;
}

const MAX_CHARS = 12_000;
const MAX_TURNS = 50;

@Injectable()
export class MemoryService {
  /** Get or create a thread memory record */
  async getOrCreate(tenantId: string, threadKey: string): Promise<any> {
    return prisma.threadMemory.upsert({
      where: { tenantId_threadKey: { tenantId, threadKey } },
      create: { tenantId, threadKey, messages: [] },
      update: {},
    });
  }

  /** Append messages to the thread, trim if needed */
  async append(tenantId: string, threadKey: string, newMessages: MemoryMessage[]): Promise<any> {
    const record = await this.getOrCreate(tenantId, threadKey);
    const existing = (record.messages as unknown as MemoryMessage[]) ?? [];
    const combined = [...existing, ...newMessages];

    // Trim oldest messages if over limits
    let trimmed = combined;
    while (
      trimmed.length > MAX_TURNS ||
      trimmed.reduce((sum, m) => sum + m.content.length, 0) > MAX_CHARS
    ) {
      trimmed = trimmed.slice(1);
    }

    return prisma.threadMemory.update({
      where: { id: record.id },
      data: {
        messages: trimmed as unknown as Prisma.InputJsonValue,
        totalTurns: { increment: newMessages.length },
        totalChars: {
          increment: newMessages.reduce((sum, m) => sum + m.content.length, 0),
        },
      },
    });
  }

  /** Update summary text (called after LLM summarization) */
  async setSummary(tenantId: string, threadKey: string, summaryText: string): Promise<any> {
    return prisma.threadMemory.update({
      where: { tenantId_threadKey: { tenantId, threadKey } },
      data: { summaryText },
    });
  }

  /** List all threads for a tenant */
  async listThreads(tenantId: string, skip = 0, take = 50): Promise<any[]> {
    return prisma.threadMemory.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        threadKey: true,
        summaryText: true,
        totalTurns: true,
        totalChars: true,
        updatedAt: true,
      },
    });
  }

  /** Get full thread with messages */
  async getThread(tenantId: string, threadKey: string): Promise<any> {
    return prisma.threadMemory.findUnique({
      where: { tenantId_threadKey: { tenantId, threadKey } },
    });
  }
}
