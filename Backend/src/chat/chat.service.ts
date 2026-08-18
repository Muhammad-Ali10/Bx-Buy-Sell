import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ChatLabelType, MessageType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisAdapterService } from 'src/redis-adapter/redis-adapter.service';

@Injectable()
export class ChatService {
  constructor(
    private db: PrismaService,
    private redis: RedisAdapterService,
  ) {}

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async findProhibitedWords(content: string) {
    const normalizedContent = content.toLowerCase();
    const words = await this.db.prohibitedWord.findMany({
      select: { id: true, word: true },
    });

    const matches: string[] = [];
    const matchedIds: string[] = [];
    for (const entry of words) {
      const rawWord = (entry.word || '').trim();
      if (!rawWord) continue;
      const normalizedWord = rawWord.toLowerCase();

      if (normalizedWord.includes(' ')) {
        if (normalizedContent.includes(normalizedWord)) {
          matches.push(rawWord);
          matchedIds.push(entry.id);
        }
        continue;
      }

      const regex = new RegExp(`\\b${this.escapeRegex(normalizedWord)}\\b`, 'i');
      if (regex.test(content)) {
        matches.push(rawWord);
        matchedIds.push(entry.id);
      }
    }

    /**
     * Counted once per message, not once per occurrence.
     *
     * The number on the Detect Words screen answers "is this rule earning its
     * place". Three hits inside one message are still one message stopped, and
     * counting each would make a word look three times as busy as it is.
     */
    if (matchedIds.length > 0) {
      void this.db.prohibitedWord
        .updateMany({
          where: { id: { in: matchedIds } },
          data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
        })
        .catch((error) => {
          // A counter is not worth failing a moderation decision over.
          console.error('Failed to record prohibited-word usage:', error);
        });
    }

    return matches;
  }

  async detectProhibitedWordsForMessage(
    senderId: string,
    content: string,
  ): Promise<string[]> {
    if (!content?.trim()) {
      return [];
    }

    const sender = await this.db.user.findUnique({
      where: { id: senderId },
      select: { role: true },
    });

    if (sender?.role === 'ADMIN' || sender?.role === 'MONITER') {
      return [];
    }

    return this.findProhibitedWords(content);
  }

  async createProhibitedWordAlert(
    chatId: string,
    senderId: string,
    matches: string[],
  ) {
    if (!matches.length) return;

    try {
      await this.db.monitoringAlert.create({
        data: {
          problem_type: 'word',
          status: 'unsolved',
          notes: `Detected prohibited word(s): ${matches.join(', ')}. Chat ID: ${chatId}`,
          reporterId: null,
          problematicUserId: senderId,
        },
      });
    } catch (alertError) {
      console.error(
        '❌ Failed to create monitoring alert for prohibited words:',
        alertError,
      );
    }
  }

  /**
   * Record that a message was blocked, as a real message in the thread.
   *
   * One row, not two. Both parties need to be told, but they need to be told
   * different things — the sender that *their* message did not go through, the
   * other that something was withheld. Storing the blocked sender's id lets
   * each side be given the right wording when the thread is read, including
   * after a refresh, which the old socket-only notice could not do.
   */
  async recordBlockedMessageNotice(chatId: string, blockedSenderId: string) {
    try {
      const notice = await this.db.message.create({
        data: {
          chatId,
          senderId: null,
          type: MessageType.SYSTEM,
          content: null,
          read: true,
          metadata: {
            kind: 'BLOCKED_MESSAGE',
            blockedSenderId,
          },
        },
      });
      return notice;
    } catch (error) {
      console.error('❌ Failed to record blocked-message notice:', error);
      return null;
    }
  }

  /**
   * Metadata for the platform's own messages, built in one place.
   *
   * These objects are used both to write a row and to look it up again, and
   * MongoDB matches a JSON value by exact shape — including key order. Two
   * literals written at two call sites would compare equal today and stop
   * matching the moment someone reorders one of them, which would silently
   * turn the duplicate guards off. One builder, one order.
   */
  private static reminderMeta(atMessage: number) {
    return { kind: 'GUIDELINE_REMINDER', atMessage };
  }

  private static dealStartedMeta(requesterId: string) {
    return { kind: 'DEAL_STARTED', requesterId };
  }

  /**
   * Record that one side asked to begin the deal process.
   *
   * Written into the conversation rather than kept in a private queue: the
   * other party needs to know it happened, and both need to be able to see
   * when. `isOffered` on the chat is what the team's dashboards already filter
   * on, so that is set too rather than inventing a second flag.
   */
  async startDealProcess(chatId: string, requesterId: string) {
    const chat = await this.db.chat.findUnique({
      where: { id: chatId },
      select: { id: true, userId: true, sellerId: true },
    });
    if (!chat) {
      throw new HttpException('Chat not found', 404);
    }
    if (chat.userId !== requesterId && chat.sellerId !== requesterId) {
      throw new HttpException('You are not part of this conversation', 403);
    }

    // Asking twice is not an error — people click things twice — but it should
    // not post the notice again.
    const existing = await this.db.message.findFirst({
      where: {
        chatId,
        type: MessageType.SYSTEM,
        metadata: { equals: ChatService.dealStartedMeta(requesterId) },
      },
    });
    if (existing) return existing;

    const [notice] = await this.db.$transaction([
      this.db.message.create({
        data: {
          chatId,
          senderId: null,
          type: MessageType.SYSTEM,
          content: null,
          read: true,
          metadata: ChatService.dealStartedMeta(requesterId),
        },
      }),
      this.db.chat.update({
        where: { id: chatId },
        data: { isOffered: true },
      }),
    ]);

    return notice;
  }

  /** How often the platform repeats the keep-it-on-the-platform reminder. */
  private static readonly REMINDER_EVERY = 20;

  /**
   * Post the periodic reminder once a conversation crosses another 20 messages.
   *
   * Counts only what the two parties said — counting the platform's own posts
   * would make the reminder trigger itself, and the gap would shrink each time.
   */
  async maybePostGuidelineReminder(chatId: string) {
    try {
      const humanMessages = await this.db.message.count({
        where: { chatId, senderId: { not: null } },
      });

      if (
        humanMessages === 0 ||
        humanMessages % ChatService.REMINDER_EVERY !== 0
      ) {
        return null;
      }

      // Stripe-style double-fire protection: if this milestone already has a
      // reminder, do not post a second one.
      const already = await this.db.message.findFirst({
        where: {
          chatId,
          type: MessageType.SYSTEM,
          metadata: { equals: ChatService.reminderMeta(humanMessages) },
        },
      });
      if (already) return null;

      return await this.db.message.create({
        data: {
          chatId,
          senderId: null,
          type: MessageType.SYSTEM,
          content: null,
          read: true,
          metadata: ChatService.reminderMeta(humanMessages),
        },
      });
    } catch (error) {
      console.error('❌ Failed to post guideline reminder:', error);
      return null;
    }
  }

  async getChatRoom(userId: string, sellerId: string, listingId?: string) {
    // CRITICAL: Find ALL chat rooms between these users and merge their messages
    const whereConditions = [
      {
        AND: [
          { userId: userId },
          { sellerId: sellerId },
        ],
      },
      {
        AND: [
          { userId: sellerId },
          { sellerId: userId },
        ],
      }
    ];
    
    // Get ALL chat rooms between these users
    const allChatRooms = await this.db.chat.findMany({
      where: {
        OR: whereConditions,
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
            // The details panel says "Last online 2 hours ago".
            is_online: true,
            last_offline: true,
          },
        },
        seller: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
            // The details panel says "Last online 2 hours ago".
            is_online: true,
            last_offline: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            sender: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                profile_pic: true,
                role: true, // CRITICAL: Include role for admin messages
              },
            },
          },
        },
        // The window header names the conversation after its listing, and a
        // listing's name lives in the brand/advertisement answers rather than
        // in a column — so those come along.
        listing: {
          include: {
            brand: true,
            advertisement: true,
            category: true,
          },
        },
        chatLabels: {
          select: {
            chatId: true,
            userId: true,
            label: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (allChatRooms.length === 0) {
      return null;
    }

    /**
     * One conversation is about one listing.
     *
     * This used to merge the messages of every room the two people shared into
     * a single thread. Two people who enquired about three businesses saw all
     * three discussions interleaved, and the details panel could only show one
     * listing for the lot — which is the "wrong listing in the corner" report.
     * A conversation now stands on its own room.
     */
    const scoped = listingId
      ? allChatRooms.filter((room) => room.listingId === listingId)
      : allChatRooms;

    // Asking for a listing these two have never discussed is not the same as
    // asking for their newest chat; say so rather than answering with another
    // listing's conversation.
    if (scoped.length === 0) {
      return null;
    }

    // Newest first from the query above, so the head is the most recent.
    const chatRoom = scoped[0];

    return {
      ...chatRoom,
      chatLabel: chatRoom.chatLabels || [],
    };
  }

  // Everything the conversation list needs in one shot, so the frontend no
  // longer makes a getUserById + getChatRoom request per room (the old N+1 that
  // made opening Chat slow). We include both participants, the per-user labels
  // and just the most recent message; unread counts are attached separately.
  private readonly conversationRoomInclude = {
    user: {
      select: {
        id: true,
        first_name: true,
        last_name: true,
        profile_pic: true,
        is_online: true,
        last_offline: true,
      },
    },
    seller: {
      select: {
        id: true,
        first_name: true,
        last_name: true,
        profile_pic: true,
        is_online: true,
        last_offline: true,
      },
    },
    chatLabels: true,
    messages: {
      orderBy: { createdAt: 'desc' as const },
      take: 1,
    },
    // The chat details panel shows the listing's name/image/price/category, so
    // include just those relations — lets the panel render instantly the first
    // time a conversation is opened (no extra getListingById round-trip).
    listing: {
      include: {
        brand: true,
        advertisement: true,
        category: true,
      },
    },
  };

  async getChatRoomsBySellerId(sellerId: string) {
    const chats = await this.db.chat.findMany({
      where: { sellerId },
      include: this.conversationRoomInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return this.attachUnreadCounts(chats, sellerId);
  }

  async getChatRoomsByUserId(userId: string) {
    const chats = await this.db.chat.findMany({
      where: { userId },
      include: this.conversationRoomInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return this.attachUnreadCounts(chats, userId);
  }

  /**
   * Attach an `unreadCount` (messages from the other party this viewer has not
   * read) to each chat using a single query instead of one request per room.
   */
  private async attachUnreadCounts<T extends { id: string }>(
    chats: T[],
    viewerId: string,
  ): Promise<Array<T & { unreadCount: number }>> {
    if (chats.length === 0) return [];
    const chatIds = chats.map((c) => c.id);
    const unreadMessages = await this.db.message.findMany({
      where: {
        chatId: { in: chatIds },
        read: false,
        senderId: { not: viewerId },
      },
      select: { chatId: true },
    });
    const unreadByChat = new Map<string, number>();
    for (const message of unreadMessages) {
      unreadByChat.set(message.chatId, (unreadByChat.get(message.chatId) ?? 0) + 1);
    }
    return chats.map((chat) => ({
      ...chat,
      unreadCount: unreadByChat.get(chat.id) ?? 0,
    }));
  }

  async createMessage(data: {
    chatId: string;
    senderId: string;
    content: string;
    type?: string;
    fileUrl?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    const { chatId, senderId, content } = data;

    // 1) Check if a very recent identical message already exists
    const now = new Date();
    const fewSecondsAgo = new Date(now.getTime() - 5000); // 5s window

    const existing = await this.db.message.findFirst({
      where: {
        chatId,
        senderId,
        content,
        createdAt: {
          gte: fewSecondsAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existing) {
      return existing;
    }

    // 2) Create new message if not found
    const saved = await this.db.message.create({
      data: {
        chatId,
        senderId,
        content,
        type: (data.type as MessageType) ?? MessageType.TEXT,
        fileUrl: data.fileUrl ?? null,
        metadata: data.metadata,
        read: false,
      },
    });

    // Create monitoring alert if prohibited word found (exclude admin/moniter senders)
    try {
      if (saved.content) {
        const sender = await this.db.user.findUnique({
          where: { id: senderId },
          select: { role: true },
        });

        if (sender?.role !== 'ADMIN' && sender?.role !== 'MONITER') {
          const matches = await this.findProhibitedWords(saved.content);
          if (matches.length > 0) {
            await this.db.monitoringAlert.create({
              data: {
                problem_type: 'word',
                status: 'unsolved',
                notes: `Detected prohibited word(s): ${matches.join(', ')}. Chat ID: ${chatId}`,
                reporterId: null,
                problematicUserId: senderId,
              },
            });
          }
        }
      }
    } catch (alertError) {
      console.error('❌ Failed to create monitoring alert for prohibited words:', alertError);
    }

    return saved;
  }

  async createSystemTimelineMessage(
    chatId: string,
    senderId: string,
    content: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.createMessage({
      chatId,
      senderId,
      content,
      type: MessageType.ADMIN,
      metadata,
    });
  }

  async updateMessage(messageId: string, userId: string, content: string) {
    // First, verify the message exists and belongs to the user
    const message = await this.db.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          select: { userId: true, sellerId: true },
        },
      },
    });

    if (!message) {
      throw new HttpException('Message not found', 404);
    }

    // Verify the user is the sender
    if (message.senderId !== userId) {
      throw new HttpException('You can only edit your own messages', 403);
    }

    // Update the message
    const updatedMessage = await this.db.message.update({
      where: { id: messageId },
      data: {
        content: content,
      },
      include: {
        sender: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
            // The details panel says "Last online 2 hours ago".
            is_online: true,
            last_offline: true,
          },
        },
      },
    });

    // Update chat room's updatedAt timestamp
    await this.db.chat.update({
      where: { id: message.chatId },
      data: { updatedAt: new Date() },
    });

    return updatedMessage;
  }

  async deleteMessage(messageId: string, userId: string) {
    // First, verify the message exists and belongs to the user
    const message = await this.db.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          select: { userId: true, sellerId: true },
        },
      },
    });

    if (!message) {
      throw new HttpException('Message not found', 404);
    }

    // Verify the user is the sender
    if (message.senderId !== userId) {
      throw new HttpException('You can only delete your own messages', 403);
    }

    const chatId = message.chatId;

    // Delete the message
    await this.db.message.delete({
      where: { id: messageId },
    });

    // Update chat room's updatedAt timestamp
    await this.db.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return { success: true, message: 'Message deleted successfully', chatId };
  }

  // Get all chats for admin
  async getAllChats() {
    try {
      // First, get total count
      const totalCount = await this.db.chat.count();
      
      // Fetch chats with all relations using include
      // Note: Using include instead of select for relations to ensure they're loaded
      const includeConfig = {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_pic: true,
          },
        },
        seller: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_pic: true,
          },
        },
        listing: {
          select: {
            id: true,
            status: true,
            portfolioLink: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc' as const,
          },
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
            read: true,
          },
        },
        chatLabels: {
          select: {
            label: true,
            userId: true,
          },
        },
        monitorViews: {
          select: {
            monitorId: true,
            viewedAt: true,
          },
        },
      } as const;

      type ChatWithIncludes = Prisma.ChatGetPayload<{
        include: typeof includeConfig;
      }>;

      const chats: ChatWithIncludes[] = await this.db.chat.findMany({
        include: includeConfig,
        orderBy: {
          updatedAt: 'desc',
        },
        // Don't filter here - we'll filter after to see what we get
      });

      // Filter out chats with null user or seller
      // Type guard function to help TypeScript understand the filtered type
      type ChatWithValidRelations = ChatWithIncludes & {
        user: NonNullable<ChatWithIncludes['user']>;
        seller: NonNullable<ChatWithIncludes['seller']>;
      };

      const validChats = chats.filter((chat): chat is ChatWithValidRelations => {
        const isValid = chat.user !== null && chat.seller !== null;
        return isValid;
      });

      return validChats;
    } catch (error: any) {
      console.error('❌ Error fetching chats:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        stack: error?.stack,
      });
      
      // Return empty array on error to prevent frontend crash
      return [];
    }
  }

  // Get all chats for monitor/admin dashboard (without filtering by current user)
  async getAllChatsForMonitor(monitorId?: string, recursiveCall = false) {
    try {
      // 1) Get counts
      const chatTableCount = await this.db.chat.count();
      const messageCount = await this.db.message.count();
      // 2) Fetch ALL chats from Chat table (primary source)
      // For MongoDB, fetch chats first without relations to avoid issues with missing foreign keys
      
      // First, get all chats without relations (more reliable for MongoDB)
      const chatsRaw = await this.db.chat.findMany({
        orderBy: {
          updatedAt: 'desc', // Sort by latest activity
        },
      });

      const chatIds = chatsRaw.map((chat) => chat.id);
      const userIds = Array.from(
        new Set(
          chatsRaw
            // The assigned team member is fetched in the same round trip as the
            // two participants, so the Responsible column costs no extra query.
            .flatMap((chat) => [chat.userId, chat.sellerId, chat.responsibleId])
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const listingIds = Array.from(
        new Set(chatsRaw.map((chat) => chat.listingId).filter(Boolean)),
      ) as string[];

      const [users, listings, latestMessages, monitorViews, chatLabels] =
        await Promise.all([
          userIds.length
            ? this.db.user.findMany({
                where: { id: { in: userIds } },
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  profile_pic: true,
                },
              })
            : [],
          listingIds.length
            ? this.db.listing.findMany({
                where: { id: { in: listingIds } },
                // portfolioLink is confidential and no chat screen reads it,
                // so it is not selected here.
                select: {
                  id: true,
                  status: true,
                  // The overview tags conversations whose business the team
                  // looks after, and each row is headed by the listing's name.
                  // The name lives in the seller's answers, not in a column,
                  // so the two question sets that can hold it come along.
                  managed_by_ex: true,
                  advertisement: { select: { question: true, answer: true } },
                  brand: { select: { question: true, answer: true } },
                },
              })
            : [],
          chatIds.length
            ? this.db.message.findMany({
                where: { chatId: { in: chatIds } },
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  chatId: true,
                  content: true,
                  createdAt: true,
                  senderId: true,
                  read: true,
                  type: true,
                },
              })
            : [],
          chatIds.length
            ? this.db.chatMonitor.findMany({
                where: { chatId: { in: chatIds } },
                select: {
                  chatId: true,
                  monitorId: true,
                  viewedAt: true,
                },
              })
            : [],
          chatIds.length
            ? this.db.chatLabel.findMany({
                where: { chatId: { in: chatIds } },
                select: {
                  chatId: true,
                  label: true,
                  userId: true,
                },
                orderBy: { updated_at: 'desc' },
              })
            : [],
        ]);

      const userMap = new Map<string, (typeof users)[number]>(
        users.map((u) => [u.id, u] as const),
      );
      const listingMap = new Map<string, (typeof listings)[number]>(
        listings.map((l) => [l.id, l] as const),
      );
      const latestMessageMap = new Map<string, (typeof latestMessages)[0]>();
      for (const msg of latestMessages) {
        if (!latestMessageMap.has(msg.chatId)) {
          latestMessageMap.set(msg.chatId, msg);
        }
      }
      const monitorViewsMap = new Map<
        string,
        { monitorId: string; viewedAt: Date }[]
      >();
      for (const view of monitorViews) {
        const existing = monitorViewsMap.get(view.chatId) || [];
        existing.push({ monitorId: view.monitorId, viewedAt: view.viewedAt });
        monitorViewsMap.set(view.chatId, existing);
      }
      const chatLabelMap = new Map<string, { label: any; userId: string }>();
      for (const label of chatLabels) {
        if (!chatLabelMap.has(label.chatId)) {
          chatLabelMap.set(label.chatId, {
            label: label.label,
            userId: label.userId,
          });
        }
      }

      const chats = await Promise.all(
        chatsRaw.map(async (chat) => {
          try {
            const user = userMap.get(chat.userId) || null;
            const seller = userMap.get(chat.sellerId) || null;
            const listing = chat.listingId
              ? listingMap.get(chat.listingId) || null
              : null;
            const latestMessage = latestMessageMap.get(chat.id);
            const messages = latestMessage ? [latestMessage] : [];
            const monitorViews = monitorViewsMap.get(chat.id) || [];

            // Count unread messages for this monitor (based on last viewed time)
            let unreadCount = 0;
            if (monitorId) {
              const lastViewed = monitorViews
                .filter((view) => view.monitorId === monitorId)
                .reduce<Date | null>((latest, view) => {
                  if (!latest || view.viewedAt > latest) return view.viewedAt;
                  return latest;
                }, null);
              if (lastViewed) {
                unreadCount = await this.db.message.count({
                  where: {
                    chatId: chat.id,
                    senderId: { in: [chat.userId, chat.sellerId] },
                    createdAt: { gt: lastViewed },
                  },
                }).catch(() => 0);
              } else {
                unreadCount = await this.db.message.count({
                  where: {
                    chatId: chat.id,
                    senderId: { in: [chat.userId, chat.sellerId] },
                  },
                }).catch(() => 0);
              }
            } else {
              unreadCount = await this.db.message.count({
                where: {
                  chatId: chat.id,
                  senderId: { in: [chat.userId, chat.sellerId] },
                },
              }).catch(() => 0);
            }

            // Fetch chat label if exists (use findFirst since chatId alone is not unique)
            const chatLabel = chatLabelMap.get(chat.id) || null;

            return {
              ...chat,
              user,
              seller,
              listing,
              // Who on the team owns this conversation, resolved for the
              // Responsible column. Null when nobody has taken it on.
              responsible: chat.responsibleId
                ? userMap.get(chat.responsibleId) || null
                : null,
              messages,
              unreadCount,
              chatLabel,
              monitorViews,
            };
          } catch (error) {
            return {
              ...chat,
              user: null,
              seller: null,
              listing: null,
              messages: [],
              chatLabel: null,
              monitorViews: [],
            };
          }
        })
      );

      // 3) For admin view, include ALL chats regardless of null relations
      // We already fetched all relations above, so now we just filter out completely invalid chats
      const validChats = chats.filter(chat => {
        // Only filter out if both user AND seller data are missing (not even IDs exist)
        // This should never happen if chats are properly created, but just in case
        if (!chat.userId || !chat.sellerId) {
          return false;
        }
        
        // Log if we have null relations (but still include the chat)
        if (!chat.user || !chat.seller) {
          // Keep chat even if relations are missing
        }
        
        return true; // Include all chats that have IDs
      });

      // 4) If no valid chats found, check if there are messages without chat rooms
      if (validChats.length === 0 && messageCount > 0) {
        // Get unique chatIds from messages that don't have chat rooms (filter out nulls)
        const allMessagesForCheck = await this.db.message.findMany({
          select: { chatId: true },
        });
        const messagesWithChatIds = allMessagesForCheck.filter(m => m.chatId !== null);
        
        const uniqueChatIds = Array.from(
          new Set(messagesWithChatIds.map(m => m.chatId).filter(Boolean))
        ) as string[];
        
        const existingChatIds = new Set(chats.map(c => c.id));
        const orphanedChatIds = uniqueChatIds.filter(id => !existingChatIds.has(id));
        
        if (orphanedChatIds.length > 0) {
          // Try to create chat rooms from orphaned messages
          let createdCount = 0;
          for (const chatId of orphanedChatIds.slice(0, 10)) { // Limit to 10 to avoid performance issues
            try {
              // Get all messages for this chatId to find participants
              const chatMessages = await this.db.message.findMany({
                where: { chatId },
                include: {
                  sender: {
                    select: {
                      id: true,
                      role: true,
                    },
                  },
                },
                orderBy: { createdAt: 'asc' },
                take: 50,
              });
              
              if (chatMessages.length === 0) continue;
              
              // Get unique participants. Messages posted by the platform have
              // no sender and say nothing about who the two parties are.
              const participants = Array.from(
                new Map(
                  chatMessages
                    .filter((m) => m.sender)
                    .map((m) => [m.sender!.id, m.sender!]),
                ).values(),
              );

              if (participants.length < 2) {
                continue;
              }

              // Determine user and seller
              const user = participants.find(p => p.role === 'USER') || participants[0];
              const seller = participants.find(p => p.role === 'SELLER') || participants[1] || participants[0];
              
              // CRITICAL: Create chat room with the EXISTING chatId (not a new one)
              // For MongoDB with Prisma, we can set the id field directly
              try {
                // Check if chat already exists (race condition)
                const existing = await this.db.chat.findUnique({
                  where: { id: chatId },
                });
                
                if (existing) {
                  createdCount++;
                  continue;
                }
                
                // Create chat room with the specific chatId from messages
                await this.db.chat.create({
                  data: {
                    id: chatId, // Use the existing chatId from messages
                    userId: user.id,
                    sellerId: seller.id,
                    status: 'ACTIVE',
                  },
                });
                
                createdCount++;
              } catch (createError: any) {
                // If chat already exists (race condition), that's fine
                if (createError.code === 'P2002' || createError.message?.includes('duplicate') || createError.message?.includes('E11000')) {
                  createdCount++;
                } else {
                  console.error(`❌ [MONITOR] Error creating chat room ${chatId}:`, {
                    error: createError.message,
                    code: createError.code,
                    user: user.id,
                    seller: seller.id,
                  });
                  throw createError;
                }
              }
            } catch (error) {
              console.error(`❌ [MONITOR] Failed to create chat room ${chatId}:`, error);
            }
          }
          
          if (createdCount > 0 && !recursiveCall) {
            // Recursively call to get the newly created chats (only once)
            return await this.getAllChatsForMonitor(monitorId, true);
          }
        }
      }
      return validChats;
    } catch (error: any) {
      console.error('❌ [MONITOR] Error fetching chats:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        stack: error?.stack,
      });
      
      // Return empty array on error to prevent frontend crash
      return [];
    }
  }

  // Get chat by ID with full details
  async getChatById(chatId: string) {
    return await this.db.chat.findUnique({
      where: {
        id: chatId,
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
            // The details panel says "Last online 2 hours ago".
            is_online: true,
            last_offline: true,
          },
        },
        seller: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
            // The details panel says "Last online 2 hours ago".
            is_online: true,
            last_offline: true,
          },
        },
        // Loading a conversation by its id is now the main path, and both the
        // window header and the details panel name it after the listing — so
        // the answer rows that hold that name have to come with it.
        listing: {
          include: {
            brand: true,
            advertisement: true,
            category: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            sender: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                profile_pic: true,
              },
            },
          },
        },
        chatLabels: {
          select: {
            label: true,
            userId: true,
          },
        },
        monitorViews: {
          select: {
            monitorId: true,
            viewedAt: true,
          },
        },
      },
    });
  }

  async getMangaedChatRoomsCountById(userId: string) {
    const count = await this.db.chatMonitor.count({
      where: {
        monitorId: userId,
      },
    });

    return {
      id: userId,
      count: count,
    };
  }

  /**
   * Put a conversation in a team member's hands, or take it back out.
   *
   * Distinct from ChatMonitor, which only records who has looked at a chat.
   * This is the assignment the overview filters and counts on.
   */
  async setChatResponsible(chatId: string, responsibleId: string | null) {
    const chat = await this.db.chat.findUnique({
      where: { id: chatId },
      select: { id: true },
    });
    if (!chat) {
      throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);
    }

    if (responsibleId) {
      const member = await this.db.user.findUnique({
        where: { id: responsibleId },
        select: { id: true, role: true },
      });
      if (!member) {
        throw new HttpException('Team member not found', HttpStatus.NOT_FOUND);
      }
      // Only the team can be made responsible for a conversation.
      if (member.role !== 'ADMIN' && member.role !== 'MONITER') {
        throw new HttpException(
          'Only admins and moderators can be assigned to a chat',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return this.db.chat.update({
      where: { id: chatId },
      data: { responsibleId },
      include: {
        responsible: {
          select: { id: true, first_name: true, last_name: true, profile_pic: true, role: true },
        },
      },
    });
  }

  /**
   * The conversation between two people that belongs to no listing.
   *
   * getChatRoom() deliberately merges every room between a pair, so it will
   * happily hand back a listing-specific one. Support needs the opposite: a
   * general thread with the member, not a thread about a particular business.
   * This looks only for `listingId: null`, and opens one if there is none.
   */
  async getOrCreateDirectChat(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new HttpException(
        'You cannot start a conversation with yourself',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.db.chat.findFirst({
      where: {
        AND: [
          {
            // On MongoDB a field that was never written is absent, not null,
            // and `listingId: null` does not match an absent field. Rooms
            // opened before this existed have no listingId at all, so both
            // shapes have to be accepted or we would open a second room on
            // every visit.
            OR: [{ listingId: null }, { listingId: { isSet: false } }],
          },
          {
            OR: [
              { userId, sellerId: otherUserId },
              { userId: otherUserId, sellerId: userId },
            ],
          },
        ],
      },
      include: this.conversationRoomInclude,
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) return existing;

    return this.db.chat.create({
      // Written explicitly so the field exists and the lookup above matches it.
      data: { userId, sellerId: otherUserId, listingId: null },
      include: this.conversationRoomInclude,
    });
  }

  async createChatRoom(userId: string, sellerId: string, listingId?: string) {
    // CRITICAL: Check if chat room exists first
    const existingRoom = await this.getChatRoom(userId, sellerId, listingId);
    
    if (existingRoom) {
      // If listingId provided and existing room doesn't have it, update it
      if (listingId && !existingRoom.listingId) {
        const updatedRoom = await this.db.chat.update({
          where: { id: existingRoom.id },
          data: { listingId: listingId },
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                profile_pic: true,
              },
            },
            seller: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                profile_pic: true,
              },
            },
            listing: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        });
        return updatedRoom;
      }
      
      return existingRoom;
    }

    // CRITICAL: Create new chat room with listingId if provided
    // This ensures each listing gets its own unique chat room
    const newChatRoom = await this.db.chat.create({
      data: {
        userId: userId,
        sellerId: sellerId,
        listingId: listingId || null, // Store listingId if provided
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
            // The details panel says "Last online 2 hours ago".
            is_online: true,
            last_offline: true,
          },
        },
        seller: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
            // The details panel says "Last online 2 hours ago".
            is_online: true,
            last_offline: true,
          },
        },
        listing: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
    
    return newChatRoom;
  }

  async updateOfferStatus(chatId: string, isOffered: boolean) {
    return await this.db.chat.update({
      where: {
        id: chatId,
      },
      data: {
        isOffered: isOffered,
      },
    });
  }

  async updateChatLabelStatus(
    chatId: string,
    userId: string,
    label: ChatLabelType,
  ) {
    return await this.db.chatLabel.upsert({
      where: {
        chatId_userId: {
          chatId: chatId,
          userId: userId,
        },
      },
      create: {
        chatId: chatId,
        userId: userId,
        label: label,
      },
      update: {
        label: label,
      },
    });
  }

  async deleteChat(chatId: string, userId: string) {
    // Verify user is part of this chat before deleting
    const chat = await this.db.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new HttpException('Chat not found', 404);
    }

    if (chat.userId !== userId && chat.sellerId !== userId) {
      throw new HttpException('Unauthorized to delete this chat', 403);
    }

    // Delete all messages first
    await this.db.message.deleteMany({
      where: { chatId: chatId },
    });

    // Delete chat labels
    await this.db.chatLabel.deleteMany({
      where: { chatId: chatId },
    });

    // Delete chat monitors
    await this.db.chatMonitor.deleteMany({
      where: { chatId: chatId },
    });

    // Delete the chat room
    await this.db.chat.delete({
      where: { id: chatId },
    });
    
    // Return success response
    return { success: true, message: 'Chat deleted successfully' };
  }

  async archiveChat(chatId: string, userId: string) {
    // Verify user is part of this chat
    const chat = await this.db.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new HttpException('Chat not found', 404);
    }

    if (chat.userId !== userId && chat.sellerId !== userId) {
      throw new HttpException('Unauthorized to archive this chat', 403);
    }

    return await this.db.chat.update({
      where: { id: chatId },
      data: { status: 'ARCHIVED' },
    });
  }

  async unarchiveChat(chatId: string, userId: string) {
    // Verify user is part of this chat
    const chat = await this.db.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new HttpException('Chat not found', 404);
    }

    if (chat.userId !== userId && chat.sellerId !== userId) {
      throw new HttpException('Unauthorized to unarchive this chat', 403);
    }

    return await this.db.chat.update({
      where: { id: chatId },
      data: { status: 'ACTIVE' },
    });
  }

  async blockUser(blockerId: string, blockedUserId: string) {
    // For now, we'll use a simple approach: mark the chat as FLAGGED
    // In a production system, you'd want a separate UserBlock model
    // Find all chats between these users
    const chats = await this.db.chat.findMany({
      where: {
        OR: [
          { userId: blockerId, sellerId: blockedUserId },
          { userId: blockedUserId, sellerId: blockerId },
        ],
      },
    });

    // Mark all chats as FLAGGED (blocked)
    const updates = chats.map(chat =>
      this.db.chat.update({
        where: { id: chat.id },
        data: { status: 'FLAGGED' },
      })
    );

    await Promise.all(updates);
    return { success: true, message: 'User blocked successfully' };
  }

  async unblockUser(blockerId: string, blockedUserId: string) {
    // Find all chats between these users
    const chats = await this.db.chat.findMany({
      where: {
        OR: [
          { userId: blockerId, sellerId: blockedUserId },
          { userId: blockedUserId, sellerId: blockerId },
        ],
        status: 'FLAGGED',
      },
    });

    // Mark all chats as ACTIVE (unblocked)
    const updates = chats.map(chat =>
      this.db.chat.update({
        where: { id: chat.id },
        data: { status: 'ACTIVE' },
      })
    );

    await Promise.all(updates);
    return { success: true, message: 'User unblocked successfully' };
  }

  // -----------------------Video Call Specific---------------
  // Mark messages as read for a chat - marks across ALL chats with the same seller
  async markMessagesAsRead(chatId: string, userId: string) {
    // Verify user is part of this chat
    const chat = await this.db.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new HttpException('Chat not found', 404);
    }

    if (chat.userId !== userId && chat.sellerId !== userId) {
      throw new HttpException('Unauthorized to mark messages as read', 403);
    }

    // Get ALL chat rooms between these users
    const whereConditions = [
      {
        AND: [
          { userId: chat.userId },
          { sellerId: chat.sellerId },
        ],
      },
      {
        AND: [
          { userId: chat.sellerId },
          { sellerId: chat.userId },
        ],
      }
    ];

    const allChatRooms = await this.db.chat.findMany({
      where: {
        OR: whereConditions,
      },
      select: {
        id: true,
      },
    });

    // Get all chat IDs
    const allChatIds = allChatRooms.map(room => room.id);

    // Mark all unread messages from other users as read across ALL chats with this seller
    const updateResult = await this.db.message.updateMany({
      where: {
        chatId: { in: allChatIds }, // All chats with this seller
        senderId: { not: userId }, // Messages not from current user
        read: false, // Only update unread messages
      },
      data: {
        read: true,
      },
    });

    return { success: true, message: 'Messages marked as read across all chats with this seller' };
  }

  // Mark messages as read for monitors/admins (only USER/SELLER messages in this chat)
  async markMessagesAsReadForMonitor(chatId: string, monitorId?: string) {
    const chat = await this.db.chat.findUnique({
      where: { id: chatId },
      select: { id: true, userId: true, sellerId: true },
    });

    if (!chat) {
      throw new HttpException('Chat not found', 404);
    }

    if (!monitorId) {
      return { success: true, message: 'Monitor not provided' };
    }

    const updated = await this.db.chatMonitor.updateMany({
      where: { chatId, monitorId },
      data: { viewedAt: new Date() },
    });

    if (updated.count === 0) {
      await this.db.chatMonitor.create({
        data: {
          chatId,
          monitorId,
          viewedAt: new Date(),
        },
      });
    }

    return { success: true, message: 'Messages marked as read for monitor' };
  }

  // Assign monitor to chat
  async assignMonitorToChat(chatId: string, monitorId: string) {
    // Verify chat exists
    const chat = await this.db.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new HttpException('Chat not found', 404);
    }

    // Verify monitor exists and has correct role
    const monitor = await this.db.user.findUnique({
      where: { id: monitorId },
      select: { id: true, role: true },
    });

    if (!monitor) {
      throw new HttpException('Monitor not found', 404);
    }

    if (monitor.role !== 'ADMIN' && monitor.role !== 'MONITER') {
      throw new HttpException('User is not a monitor or admin', 403);
    }

    // Check if already assigned
    const existingAssignment = await this.db.chatMonitor.findFirst({
      where: { chatId, monitorId },
    });

    if (existingAssignment) {
      return {
        success: true,
        message: 'Chat already assigned to this monitor',
        assignment: existingAssignment,
      };
    }

    // Create assignment
    const assignment = await this.db.chatMonitor.create({
      data: {
        chatId,
        monitorId,
        viewedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Chat assigned successfully',
      assignment,
    };
  }

  // Unassign monitor from chat
  async unassignMonitorFromChat(chatId: string, monitorId?: string) {
    // Verify chat exists
    const chat = await this.db.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new HttpException('Chat not found', 404);
    }

    // Delete assignment(s)
    const whereCondition: any = { chatId };
    if (monitorId) {
      whereCondition.monitorId = monitorId;
    }

    const deleteResult = await this.db.chatMonitor.deleteMany({
      where: whereCondition,
    });

    return {
      success: deleteResult.count > 0,
      message: deleteResult.count > 0 ? 'Chat unassigned successfully' : 'No assignment found to unassign',
      count: deleteResult.count,
    };
  }

  // Get assigned monitor for a chat
  async getAssignedMonitor(chatId: string) {
    const assignments = await this.db.chatMonitor.findMany({
      where: { chatId },
      include: {
        monitor: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
            role: true,
          },
        },
      },
      orderBy: {
        viewedAt: 'desc',
      },
    });

    if (assignments.length === 0) {
      return {
        success: true,
        assigned: false,
        monitor: null,
      };
    }

    return {
      success: true,
      assigned: true,
      monitor: assignments[0].monitor,
      assignment: assignments[0],
      allAssignments: assignments,
    };
  }
}
