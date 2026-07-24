import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Job, Queue, Worker } from 'bullmq';
import { MessageType } from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';

export const connection = {
  host: 'localhost',
  port: 6379,
};

@Injectable()
export class MessageQueueService {
  queues: Map<string, Queue>;

  constructor(private db: PrismaService) {
    this.queues = new Map();
  }

  getOrCreateQueue(queueName: string): Queue | any {
    try {
      if (!this.queues.has(queueName)) {
        const queue = new Queue(queueName, { connection });
        this.queues.set(queueName, queue);
      }
      return this.queues.get(queueName)!;
    } catch (error) {
      console.log(error.message);
    }
  }

  // Main Function
  async queueMessage(message: any) {
    const queue = this.getOrCreateQueue(message.chatId);
    try {
      queue.resume();

      await queue.add(message.chatId, message);

      this.startBundlingWorker(queue);

      return { status: 'queued' };
    } catch (error) {
      queue.pause();
      console.log(error, 'is error');
    }
  }

  // Worker
  async startBundlingWorker(queue: Queue) {
    try {
      queue.resume();
      const jobs = await queue.getJobs(['waiting', 'delayed'], 0, -1);
      if (jobs.length > 0) {
        const bundledMessages = jobs.map((job) => job.data);

        // Filter out messages that are already saved (have an ID)
        // Messages with IDs are already saved directly via createMessage()
        // Only process messages without IDs (queued before direct save was implemented)
        const messagesToSave = bundledMessages.filter((message) => !message.id);

        if (messagesToSave.length > 0) {
          // Check for existing messages to prevent duplicates
          interface MessageToCreate {
            chatId: string;
            senderId: string;
            content: string;
            type: MessageType;
            fileUrl: string | null;
          }

          const messagesToCreate: MessageToCreate[] = [];
          for (const message of messagesToSave) {
            // Check if message already exists in database
            let existing: { id: string } | null = null;
            if (message.createdAt) {
              const messageDate = new Date(message.createdAt);
              const startDate = new Date(messageDate.getTime() - 1000); // 1 second before
              const endDate = new Date(messageDate.getTime() + 1000); // 1 second after
              
              existing = await this.db.message.findFirst({
                where: {
                  chatId: message.chatId,
                  senderId: message.senderId,
                  content: message.content,
                  type: (message.type || 'TEXT') as MessageType,
                  createdAt: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
                select: { id: true },
              });
            } else {
              // If no createdAt, check by content, chatId, senderId, and type
              existing = await this.db.message.findFirst({
                where: {
                  chatId: message.chatId,
                  senderId: message.senderId,
                  content: message.content,
                  type: (message.type || 'TEXT') as MessageType,
                },
                select: { id: true },
              });
            }

            if (!existing) {
              messagesToCreate.push({
                chatId: message.chatId,
                senderId: message.senderId,
                content: message.content,
                type: (message.type || 'TEXT') as MessageType,
                fileUrl: message.fileUrl || null,
              });
            } else {
              console.log('⚠️ [MessageQueueService] Skipping duplicate message in queue:', {
                chatId: message.chatId,
                senderId: message.senderId,
                content: message.content?.substring(0, 30),
                existingId: existing.id,
              });
            }
          }

          if (messagesToCreate.length > 0) {
            // 👇 Only create messages that don't already exist
            // Note: skipDuplicates is not supported in MongoDB Prisma client
            // We already filtered duplicates above, so we can safely create these
            await this.db.message.createMany({
              data: messagesToCreate,
            });
            console.log(`✅ Saved ${messagesToCreate.length} messages from queue (${bundledMessages.length - messagesToCreate.length} were duplicates)`);
          } else {
            console.log('⚠️ All messages in queue were duplicates, skipping save');
          }
        } else {
          console.log('⚠️ All messages in queue already have IDs (already saved), skipping queue save');
        }

        // Clean up jobs after bundling
        await Promise.all(jobs.map((job: Job) => job.remove()));
        await queue.clean(0, -1);
      }
    } catch (error) {
      queue.pause();
      console.log(error, 'is error');
    }
  }
}
