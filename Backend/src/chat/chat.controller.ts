import { Body, Controller, Get, Param, Put, Query, Delete, Post, Req, ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatLabelType } from '@prisma/client';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { UpdateLabelDTO, updateLabelSchema } from './dto/update-label';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { Roles } from 'common/decorator/roles.decorator';
import { ListingService } from 'src/listing/listing.service';
@Roles(['ADMIN', 'MONITER']) // Default: Only admin/moniter, but individual endpoints override this
@Controller('chat')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private listingService: ListingService,
  ) {}
  private isStaffRole(role?: string) {
    return role === 'ADMIN' || role === 'MONITER' || role === 'STAFF';
  }

  private ensureSelfOrStaff(userId: string, req: any) {
    const currentUser = req?.user;
    if (!currentUser) {
      throw new ForbiddenException('Unauthorized');
    }

    if (this.isStaffRole(currentUser.role)) {
      return;
    }

    if (currentUser.id !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }
  //  Chat Specific
  @Roles(['ADMIN', 'MONITER', 'USER']) // CRITICAL: Allow USER role to fetch their own chats
  @Get('/fetch/user/:userId')
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  getChatRoomsByUserId(@Param('userId') userId: string, @Req() req: any) {
    this.ensureSelfOrStaff(userId, req);
    return this.chatService.getChatRoomsByUserId(userId);
  }

  @Roles(['ADMIN', 'MONITER', 'USER']) // CRITICAL: Allow USER role to fetch chats where they are seller
  @Get('/fetch/seller/:sellerId')
  @ApiParam({ name: 'sellerId', description: 'Seller ID', type: String })
  getChatRoomsBySellerId(@Param('sellerId') sellerId: string, @Req() req: any) {
    this.ensureSelfOrStaff(sellerId, req);
    return this.chatService.getChatRoomsBySellerId(sellerId);
  }
  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Get('/fetch/:userId/:sellerId')
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  @ApiParam({ name: 'sellerId', description: 'Seller ID', type: String })
  fetchChatRoom(
    @Param('userId') userId: string,
    @Param('sellerId') sellerId: string,
    @Req() req: any,
    @Query('listingId') listingId?: string, // CRITICAL: Optional listingId to scope chat to specific listing
  ) {
    const currentUser = req?.user;
    if (!currentUser || (!this.isStaffRole(currentUser.role) && currentUser.id !== userId && currentUser.id !== sellerId)) {
      throw new ForbiddenException('Access denied');
    }
    return this.chatService.getChatRoom(userId, sellerId, listingId);
  }

  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Get('/create/:userId/:sellerId')
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  @ApiParam({ name: 'sellerId', description: 'Seller ID', type: String })
  createChatRoom(
    @Param('userId') userId: string,
    @Param('sellerId') sellerId: string,
    @Query('listingId') listingId?: string, // CRITICAL: Optional listingId to create listing-specific chat
  ) {
    return this.chatService.createChatRoom(userId, sellerId, listingId);
  }

  @Get('/get-chat-count/:userId')
  @ApiParam({ name: 'userId', description: 'Admin/Moniter ID', type: String })
  get(
    @Param('userId') userId: string,
  ) {
    return this.chatService.getMangaedChatRoomsCountById(userId);
  }

  // Get all chats for admin
  @Get('/all')
  @Roles(['ADMIN', 'MONITER', 'STAFF'])
  getAllChats() {
    return this.chatService.getAllChats();
  }

  // Get all chats for monitor/admin dashboard (dedicated endpoint)
  // IMPORTANT: This route must be BEFORE /:id to avoid route conflicts
  @Get('monitor/all')
  @Roles(['ADMIN', 'MONITER', 'STAFF'])
  async getAllChatsForMonitor(
    @Req() req: any,
    @Query('monitorId') monitorId?: string,
  ) {
    try {
      const resolvedMonitorId = monitorId || req.user?.id;
      const result = await this.chatService.getAllChatsForMonitor(resolvedMonitorId);
      return result;
    } catch (error: any) {
      // Return empty array to prevent frontend crash
      return [];
    }
  }

  // Diagnostic endpoint to check database state
  @Get('monitor/debug')
  @Roles(['ADMIN', 'MONITER', 'STAFF'])
  async getMonitorDebug() {
    try {
      const db = this.chatService['db'];
      
      const chatCount = await db.chat.count();
      const messageCount = await db.message.count();
      
      // Get all chats with user/seller info
      const allChats = await db.chat.findMany({
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          seller: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      });
      
      // Count chats with null user/seller
      const chatsWithNullUser = allChats.filter(c => c.user === null).length;
      const chatsWithNullSeller = allChats.filter(c => c.seller === null).length;
      const validChats = allChats.filter(c => c.user !== null && c.seller !== null).length;
      
      // Get unique chatIds from messages (filter out nulls)
      const allMessages = await db.message.findMany({
        select: { chatId: true },
      });
      const messagesWithChatIds = allMessages.filter(m => m.chatId !== null);
      const uniqueChatIds = Array.from(new Set(messagesWithChatIds.map(m => m.chatId).filter(Boolean)));
      
      // Find orphaned messages (chatIds that don't exist in Chat table)
      const existingChatIds = new Set(allChats.map(c => c.id));
      const orphanedChatIds = uniqueChatIds.filter(id => !existingChatIds.has(id));
      
      const sampleMessages = await db.message.findMany({
        take: 5,
        select: {
          id: true,
          chatId: true,
          senderId: true,
          content: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      
      return {
        summary: {
          chatTableCount: chatCount,
          messageTableCount: messageCount,
          uniqueChatIdsInMessages: uniqueChatIds.length,
          orphanedChatIds: orphanedChatIds.length,
          validChats: validChats,
          chatsWithNullUser,
          chatsWithNullSeller,
        },
        sampleChats: allChats.map(c => ({
          id: c.id,
          userId: c.userId,
          sellerId: c.sellerId,
          hasUser: !!c.user,
          hasSeller: !!c.seller,
          userEmail: c.user?.email || 'NULL',
          sellerEmail: c.seller?.email || 'NULL',
          updatedAt: c.updatedAt,
        })),
        sampleMessages,
        orphanedChatIds: orphanedChatIds.slice(0, 10),
        diagnosis: {
          issue: chatCount === 0 
            ? 'No chats in database. Messages may exist without chat rooms.'
            : validChats === 0
            ? 'All chats have null user or seller (data integrity issue)'
            : 'Chats exist and are valid',
          recommendation: chatCount === 0 && messageCount > 0
            ? 'Create chat rooms from existing messages using the auto-creation feature'
            : validChats === 0
            ? 'Fix user/seller foreign key references in database'
            : 'No issues detected',
        },
      };
    } catch (error: any) {
      return {
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Put('/update/label')
  @ApiBody({ type: () => UpdateLabelDTO })
  updateChatLabelStatus(@Body(new ZodValidationPipe(updateLabelSchema)) body, @Req() req: any) {
    const { userId, chatId, label } = body;
    this.ensureSelfOrStaff(userId, req);
    return this.chatService.updateChatLabelStatus(
      chatId,
      userId,
      label as ChatLabelType,
    );
  }

  // Delete chat (must be before /:id route to avoid conflicts)
  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Delete('/delete/:chatId/:userId')
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: String })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  async deleteChat(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    this.ensureSelfOrStaff(userId, req);
    return this.chatService.deleteChat(chatId, userId);
  }

  // Archive chat
  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Put('/archive/:chatId/:userId')
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: String })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  async archiveChat(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    this.ensureSelfOrStaff(userId, req);
    return this.chatService.archiveChat(chatId, userId);
  }

  // Unarchive chat
  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Put('/unarchive/:chatId/:userId')
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: String })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  async unarchiveChat(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    this.ensureSelfOrStaff(userId, req);
    return this.chatService.unarchiveChat(chatId, userId);
  }

  // Block user
  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Post('/block/:blockerId/:blockedUserId')
  @ApiParam({ name: 'blockerId', description: 'User ID who is blocking', type: String })
  @ApiParam({ name: 'blockedUserId', description: 'User ID being blocked', type: String })
  async blockUser(
    @Param('blockerId') blockerId: string,
    @Param('blockedUserId') blockedUserId: string,
    @Req() req: any,
  ) {
    this.ensureSelfOrStaff(blockerId, req);
    return this.chatService.blockUser(blockerId, blockedUserId);
  }

  // Unblock user
  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Post('/unblock/:blockerId/:blockedUserId')
  @ApiParam({ name: 'blockerId', description: 'User ID who is unblocking', type: String })
  @ApiParam({ name: 'blockedUserId', description: 'User ID being unblocked', type: String })
  async unblockUser(
    @Param('blockerId') blockerId: string,
    @Param('blockedUserId') blockedUserId: string,
    @Req() req: any,
  ) {
    this.ensureSelfOrStaff(blockerId, req);
    return this.chatService.unblockUser(blockerId, blockedUserId);
  }

  // Mark messages as read
  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Put('/mark-read/:chatId/:userId')
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: String })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  async markMessagesAsRead(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    this.ensureSelfOrStaff(userId, req);
    return this.chatService.markMessagesAsRead(chatId, userId);
  }

  // Mark messages as read for monitor/admin (only USER/SELLER messages)
  @Roles(['ADMIN', 'MONITER', 'STAFF'])
  @Put('/mark-read/monitor/:chatId')
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: String })
  async markMessagesAsReadForMonitor(
    @Param('chatId') chatId: string,
    @Req() req: any,
    @Query('monitorId') monitorId?: string,
  ) {
    const resolvedMonitorId = monitorId || req.user?.id;
    return this.chatService.markMessagesAsReadForMonitor(chatId, resolvedMonitorId);
  }

  // Assign monitor to chat - MUST be before /:id route to avoid conflicts
  @Roles(['ADMIN', 'MONITER', 'STAFF'])
  @Post('/assign/:chatId/:monitorId')
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: String })
  @ApiParam({ name: 'monitorId', description: 'Monitor/Admin ID', type: String })
  async assignMonitorToChat(
    @Param('chatId') chatId: string,
    @Param('monitorId') monitorId: string,
  ) {
    return this.chatService.assignMonitorToChat(chatId, monitorId);
  }

  // Unassign monitor from chat - MUST be before /:id route to avoid conflicts
  @Roles(['ADMIN', 'MONITER', 'STAFF'])
  @Delete('/unassign/:chatId')
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: String })
  async unassignMonitorFromChat(
    @Param('chatId') chatId: string,
    @Query('monitorId') monitorId?: string,
  ) {
    return this.chatService.unassignMonitorFromChat(chatId, monitorId);
  }

  // Get assigned monitor for a chat - MUST be before /:id route to avoid conflicts
  @Roles(['ADMIN', 'MONITER', 'STAFF', 'USER'])
  @Get('/assigned/:chatId')
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: String })
  async getAssignedMonitor(
    @Param('chatId') chatId: string,
  ) {
    return this.chatService.getAssignedMonitor(chatId);
  }

  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Post('/confidential/grant/:chatId')
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: String })
  async grantConfidentialAccessFromChat(
    @Param('chatId') chatId: string,
    @Req() req: any,
  ) {
    const chat = await this.chatService.getChatById(chatId);
    if (!chat || !chat.listingId) {
      throw new ForbiddenException('Chat listing not found');
    }

    const currentUser = req?.user;
    if (!currentUser || currentUser.id !== chat.sellerId) {
      throw new ForbiddenException(
        'Only the seller can grant confidential access from chat.',
      );
    }

    const grantResult = await this.listingService.grantConfidentialAccess(
      chat.listingId,
      chat.sellerId,
      chat.userId,
      chatId,
    );

    await this.chatService.createSystemTimelineMessage(
      chatId,
      currentUser.id,
      'Seller has granted access to confidential listing details.',
      {
        eventType: 'CONFIDENTIAL_ACCESS_GRANTED',
        listingId: chat.listingId,
        buyerId: chat.userId,
        sellerId: chat.sellerId,
        chatId,
      },
    );

    return {
      success: true,
      grant: grantResult,
    };
  }

  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Delete('/confidential/revoke/:chatId')
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: String })
  async revokeConfidentialAccessFromChat(
    @Param('chatId') chatId: string,
    @Req() req: any,
  ) {
    const chat = await this.chatService.getChatById(chatId);
    if (!chat || !chat.listingId) {
      throw new ForbiddenException('Chat listing not found');
    }

    const currentUser = req?.user;
    if (!currentUser || currentUser.id !== chat.sellerId) {
      throw new ForbiddenException(
        'Only the seller can revoke confidential access from chat.',
      );
    }

    const revokeResult = await this.listingService.revokeConfidentialAccess(
      chat.listingId,
      chat.sellerId,
      chat.userId,
    );

    await this.chatService.createSystemTimelineMessage(
      chatId,
      currentUser.id,
      'Seller has revoked access to confidential listing details.',
      {
        eventType: 'CONFIDENTIAL_ACCESS_REVOKED',
        listingId: chat.listingId,
        buyerId: chat.userId,
        sellerId: chat.sellerId,
        chatId,
      },
    );

    return {
      success: true,
      revoke: revokeResult,
    };
  }

  // Edit message
  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Put('/message/:messageId/edit')
  @ApiParam({ name: 'messageId', description: 'Message ID', type: String })
  async editMessage(
    @Param('messageId') messageId: string,
    @Body('content') content: string,
    @Req() req: Request,
  ) {
    const { id: userId } = (req as any).user;
    return this.chatService.updateMessage(messageId, userId, content);
  }

  // Delete message
  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Delete('/message/:messageId/delete')
  @ApiParam({ name: 'messageId', description: 'Message ID', type: String })
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Req() req: Request,
  ) {
    const { id: userId } = (req as any).user;
    return this.chatService.deleteMessage(messageId, userId);
  }

  // Get chat by ID with full details (must be last to avoid route conflicts)
  @Get('/:id')
  @Roles(['ADMIN', 'MONITER', 'STAFF', 'USER'])
  @ApiParam({ name: 'id', description: 'Chat ID', type: String })
  async getChatById(@Param('id') id: string, @Req() req: any) {
    const chat = await this.chatService.getChatById(id);
    const currentUser = req?.user;
    if (!currentUser) {
      throw new ForbiddenException('Unauthorized');
    }
    if (!this.isStaffRole(currentUser.role) && chat && chat.userId !== currentUser.id && chat.sellerId !== currentUser.id) {
      throw new ForbiddenException('Access denied');
    }
    return chat;
  }
}
