import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MonitoringAlertService {
  constructor(private readonly db: PrismaService) {}

  async findAll() {
    return this.db.monitoringAlert.findMany({
      include: {
        reporter: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
          },
        },
        problematic_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
          },
        },
        responsible: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
          },
        },
        // Present when the alert is a listing report, so the team can open it.
        listing: {
          select: {
            id: true,
            advertisement: { select: { question: true, answer: true } },
          },
        },
        // Present when the alert is a chat report. The eye icon opens this
        // rather than digging a chat id out of the note text.
        chat: {
          select: { id: true, userId: true, sellerId: true, listingId: true },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  /**
   * A user reports a listing. It lands in the same monitoring queue the team
   * already uses, tagged with the listing so moderators can open it directly.
   */
  async reportListing(
    reporterId: string,
    input: { listingId: string; reason: string; notes?: string },
  ) {
    const listing = await this.db.listing.findUnique({
      where: { id: input.listingId },
      select: { id: true, userId: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Don't queue the same open report from the same person twice.
    const existing = await this.db.monitoringAlert.findFirst({
      where: {
        listingId: input.listingId,
        reporterId,
        status: 'unsolved',
      } as any,
    });
    if (existing) return existing;

    return this.db.monitoringAlert.create({
      data: {
        problem_type: input.reason,
        notes: input.notes?.trim() || null,
        reporterId,
        problematicUserId: listing.userId,
        listingId: listing.id,
      } as any,
    });
  }

  /**
   * A member reports a conversation.
   *
   * Nothing existed for this: the dialog congratulated the reporter and threw
   * the report away, which is why reported chats never reached the queue. The
   * chat is recorded on the alert so a moderator can open the conversation
   * itself, and the other party is named as the person complained about.
   */
  async reportChat(
    reporterId: string,
    input: { chatId: string; reason: string; notes?: string },
  ) {
    const chat = await this.db.chat.findUnique({
      where: { id: input.chatId },
      select: { id: true, userId: true, sellerId: true },
    });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Only the two people in the conversation can report it.
    if (chat.userId !== reporterId && chat.sellerId !== reporterId) {
      throw new ForbiddenException('You are not part of this conversation.');
    }

    const otherPartyId = chat.userId === reporterId ? chat.sellerId : chat.userId;

    // One open report per person per chat; pressing the button twice is not two
    // problems for the team to work through.
    const existing = await this.db.monitoringAlert.findFirst({
      where: { chatId: chat.id, reporterId, status: 'unsolved' } as any,
    });
    if (existing) return existing;

    return this.db.monitoringAlert.create({
      data: {
        problem_type: input.reason,
        notes: input.notes?.trim() || null,
        reporterId,
        problematicUserId: otherPartyId,
        chatId: chat.id,
      } as any,
    });
  }

  async updateStatus(id: string, status: string) {
    return this.db.monitoringAlert.update({
      where: { id },
      data: { status },
    });
  }

  async assignResponsible(id: string, responsibleId: string | null) {
    return this.db.monitoringAlert.update({
      where: { id },
      data: { responsibleId: responsibleId || null },
    });
  }
}
