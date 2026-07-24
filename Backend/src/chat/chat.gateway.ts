import {
  SubscribeMessage,
  WebSocketGateway,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  WebSocketServer,
  WsException,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { MessageQueueService } from 'src/message-queue/message-queue.service';
import { RedisAdapterService } from 'src/redis-adapter/redis-adapter.service';
import { ChatService } from './chat.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { z } from 'zod';
import parsePhoneNumberFromString from 'libphonenumber-js';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ 
  cors: { 
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  io: Server;

  // Track active connections and their rooms
  private activeConnections = new Map<string, Set<string>>();
  private userSockets = new Map<string, Set<string>>();
  private lastSeenByUser = new Map<string, number>();
  private readonly HEARTBEAT_TIMEOUT_MS = 90_000;
  private readonly HEARTBEAT_CHECK_INTERVAL_MS = 30_000;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(
    private readonly redisAdapterService: RedisAdapterService,
    private readonly messageQueueService: MessageQueueService,
    private readonly chatService: ChatService,
    private readonly db: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private isStaffRole(role?: string | null) {
    return role === 'ADMIN' || role === 'MONITER' || role === 'STAFF';
  }

  private async ensureChatAccess(chatId: string, userId: string | null, role?: string | null) {
    if (!chatId) {
      throw new WsException('chatId is required');
    }

    if (this.isStaffRole(role)) {
      return;
    }

    if (!userId) {
      throw new WsException('User not authenticated');
    }

    const chat = await this.db.chat.findUnique({
      where: { id: chatId },
      select: { userId: true, sellerId: true },
    });

    if (!chat) {
      throw new WsException('Chat not found');
    }

    if (chat.userId !== userId && chat.sellerId !== userId) {
      throw new WsException('Unauthorized to access this chat');
    }
  }

  private async emitMessageNotify(chatId: string, senderId: string) {
    try {
      const chat = await this.db.chat.findUnique({
        where: { id: chatId },
        select: { userId: true, sellerId: true },
      });

      if (!chat) return;

      const recipientIds = [chat.userId, chat.sellerId];
      recipientIds.forEach((id) => {
        this.io.to(`user:${id}`).emit('message:notify', {
          chatId,
          senderId,
        });
      });
    } catch (error) {
      console.error('❌ Failed to emit message:notify:', error);
    }
  }


  async afterInit(server: Server) {
    this.io = server;
    console.log('🚀 WebSocket Gateway initialized');
    try {
      await this.redisAdapterService.connectToRedis();
      console.log('✅ Redis adapter connected');
    } catch (error) {
      console.error('❌ Failed to connect Redis adapter:', error);
    }

    try {
      // On server boot, clear stale online flags to ensure presence is socket-driven
      await this.db.user.updateMany({
        where: { is_online: true },
        data: { is_online: false, last_offline: new Date() },
      });
    } catch (error) {
      console.error('❌ Failed to reset online status on boot:', error);
    }

    if (!this.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => {
        const now = Date.now();
        this.lastSeenByUser.forEach((lastSeen, userId) => {
          if (now - lastSeen > this.HEARTBEAT_TIMEOUT_MS) {
            const sockets = this.userSockets.get(userId) || new Set();
            sockets.forEach((socketId) => {
              const socket = this.io.sockets.sockets.get(socketId);
              if (socket) {
                socket.disconnect(true);
              }
            });
            this.userSockets.delete(userId);
            this.lastSeenByUser.delete(userId);
            this.db.user.update({
              where: { id: userId },
              data: { is_online: false, last_offline: new Date() },
            }).then(() => {
              this.io.emit('user:status-changed', {
                userId,
                isOnline: false,
                last_offline: new Date().toISOString(),
              });
            }).catch((error) => {
              console.error('❌ Error updating user offline status (heartbeat):', error);
            });
          }
        });
      }, this.HEARTBEAT_CHECK_INTERVAL_MS);
    }
  }

  async handleConnection(client: Socket) {
    // Extract token from handshake auth
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
    
    console.log('👤 Client connecting:', {
      clientId: client.id,
      hasToken: !!token,
      auth: client.handshake.auth,
      headers: Object.keys(client.handshake.headers)
    });
    
    let userId: string | null = null;
    
    if (!token) {
      console.warn('⚠️ Missing auth token for socket connection. Disconnecting.');
      client.disconnect(true);
      return;
    }

    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('❌ JWT_SECRET is not set. Disconnecting socket.');
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, { secret: jwtSecret });
      const userRole = payload.role;
      userId = payload.id;

      (client as any).userId = userId;
      (client as any).userRole = userRole;

      if (this.isStaffRole(userRole)) {
        client.join('monitor-room');
        console.log('✅ Monitor user joined monitor-room:', {
          clientId: client.id,
          role: userRole,
          userId: userId
        });
      }

      if (userId) {
        try {
          const sockets = this.userSockets.get(userId) || new Set();
          sockets.add(client.id);
          this.userSockets.set(userId, sockets);
          this.lastSeenByUser.set(userId, Date.now());

          await this.db.user.update({
            where: { id: userId },
            data: { is_online: true },
          });
          console.log('✅ User marked as online:', userId);

          this.io.emit('user:status-changed', {
            userId: userId,
            isOnline: true,
            last_offline: null,
          });
        } catch (error) {
          console.error('❌ Error updating user online status:', error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Invalid socket auth token. Disconnecting.', error);
      client.disconnect(true);
      return;
    }
    
    // Note: Authentication can be added here if needed
    // For now, we allow connection but validate on message send
    
    this.activeConnections.set(client.id, new Set());
    console.log('✅ Client connected:', client.id, userId ? `(User: ${userId})` : '');
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId;
    console.log('👋 Client disconnected:', client.id, userId ? `(User: ${userId})` : '');
    
    // CRITICAL: Update user online status when they disconnect
    if (userId) {
      const sockets = this.userSockets.get(userId) || new Set();
      sockets.delete(client.id);
      if (sockets.size > 0) {
        this.userSockets.set(userId, sockets);
        this.lastSeenByUser.set(userId, Date.now());
        return;
      }
      this.userSockets.delete(userId);
      this.lastSeenByUser.delete(userId);
      
      // Only mark offline if no other connections exist
      this.db.user.update({
        where: { id: userId },
        data: { is_online: false, last_offline: new Date() },
      }).then(() => {
        console.log('✅ User marked as offline:', userId);
        
        // Emit user offline status to all clients
        this.io.emit('user:status-changed', {
          userId: userId,
          isOnline: false,
          last_offline: new Date().toISOString(),
        });
      }).catch((error) => {
        console.error('❌ Error updating user offline status:', error);
      });
    }
    
    this.activeConnections.delete(client.id);
  }

  @SubscribeMessage('user:heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
  ) {
    const userId = (client as any).userId;
    if (!userId) return;
    this.lastSeenByUser.set(userId, Date.now());
  }

  // Join Room - CRITICAL: Only allow joining ONE room at a time
  @SubscribeMessage('join:room')
  async handleJoinRoom(
    @MessageBody() { chatId }: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = (client as any).userId;
      const userRole = (client as any).userRole;
      await this.ensureChatAccess(chatId, userId, userRole);

      // CRITICAL: Leave all other rooms first to ensure isolation
      const currentRooms = this.activeConnections.get(client.id) || new Set();
      currentRooms.forEach(room => {
        if (room !== client.id) { // Don't leave the default socket.io room
          client.leave(room);
          console.log('📤 Client', client.id, 'left room:', room);
        }
      });

      // Join the new room
      client.join(chatId);
      this.activeConnections.set(client.id, new Set([chatId]));
      
      // Verify room membership immediately
      const roomClients = this.io.sockets.adapter.rooms.get(chatId);
      const clientCount = roomClients?.size || 0;
      
      console.log('✅ Client', client.id, 'joined room:', chatId);
      console.log('📊 Room', chatId, 'now has', clientCount, 'client(s)');
      
      // Send confirmation to client
      client.emit('room:joined', { 
        chatId, 
        success: true,
        clientCount 
      });
      
      return { success: true, chatId, clientCount };
    } catch (error) {
      console.error('❌ Error joining room:', error);
      client.emit('error', { 
        message: error instanceof Error ? error.message : 'Failed to join room' 
      });
      throw new WsException('Failed to join room');
    }
  }

  // Leave Room
  @SubscribeMessage('leave:room')
  handleLeaveRoom(
    @MessageBody() { chatId }: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      if (chatId === 'all') {
        // Leave all rooms except the default socket.io room
        const rooms = this.activeConnections.get(client.id) || new Set();
        rooms.forEach(room => {
          if (room !== client.id) {
            client.leave(room);
            console.log('📤 Client', client.id, 'left room:', room);
          }
        });
        this.activeConnections.set(client.id, new Set());
        console.log('📤 Client', client.id, 'left all chat rooms');
      } else if (chatId) {
        client.leave(chatId);
        const rooms = this.activeConnections.get(client.id) || new Set();
        rooms.delete(chatId);
        this.activeConnections.set(client.id, rooms);
        console.log('📤 Client', client.id, 'left room:', chatId);
      }
    } catch (error) {
      console.error('❌ Error leaving room:', error);
      throw new WsException('Failed to leave room');
    }
  }

  @SubscribeMessage('edit:message')
  async handleEditMessage(
    @MessageBody() data: { messageId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = (client as any).userId;
      if (!userId) {
        throw new WsException('User not authenticated');
      }

      const updatedMessage = await this.chatService.updateMessage(
        data.messageId,
        userId,
        data.content,
      );

      // Get the chat room ID
      const message = await this.db.message.findUnique({
        where: { id: data.messageId },
        select: { chatId: true },
      });

      if (!message) {
        throw new WsException('Message not found');
      }

      // Emit edit event to all clients in the room
      const messageString = JSON.stringify({
        id: updatedMessage.id,
        chatId: message.chatId,
        content: updatedMessage.content,
        senderId: updatedMessage.senderId,
        type: 'message_edited',
        createdAt: updatedMessage.createdAt,
        updatedAt: (updatedMessage as any).updatedAt || updatedMessage.createdAt,
      });

      console.log('📝 EMIT message_edited:', updatedMessage.id, 'to room:', message.chatId);
      this.io.to(message.chatId).emit('message:edited', messageString);

      return { success: true, message: updatedMessage };
    } catch (error) {
      console.error('❌ Error in handleEditMessage:', error);
      throw new WsException(error instanceof Error ? error.message : 'Failed to edit message');
    }
  }

  @SubscribeMessage('delete:message')
  async handleDeleteMessage(
    @MessageBody() data: { messageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = (client as any).userId;
      if (!userId) {
        throw new WsException('User not authenticated');
      }

      // Get message info before deletion
      const message = await this.db.message.findUnique({
        where: { id: data.messageId },
        select: { chatId: true, senderId: true },
      });

      if (!message) {
        throw new WsException('Message not found');
      }

      const result = await this.chatService.deleteMessage(data.messageId, userId);

      // Emit delete event to all clients in the room
      const deleteEvent = JSON.stringify({
        messageId: data.messageId,
        chatId: result.chatId,
        type: 'message_deleted',
      });

      console.log('🗑️ EMIT message_deleted:', data.messageId, 'to room:', result.chatId);
      this.io.to(result.chatId).emit('message:deleted', deleteEvent);

      return { success: true };
    } catch (error) {
      console.error('❌ Error in handleDeleteMessage:', error);
      throw new WsException(error instanceof Error ? error.message : 'Failed to delete message');
    }
  }

  // Send Message - CRITICAL: Only broadcast to the specific room
  @SubscribeMessage('send:message')
  async handleSendMessage(
    @MessageBody() message: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const socketUserId = (client as any).userId;
      const socketUserRole = (client as any).userRole;

      // Validate message
      if (!message.chatId || !message.senderId || !message.content) {
        throw new WsException('Invalid message format: chatId, senderId, and content are required');
      }

      if (!socketUserId || message.senderId !== socketUserId) {
        throw new WsException('Unauthorized sender');
      }

      // Validate content (prevent emails/phone numbers)
      const schema = z.string().email();
      const isValid = (message.content as string).split(' ').findIndex((el) => {
        if (
          schema.safeParse(el).success ||
          parsePhoneNumberFromString(el)?.isValid()
        ) {
          return true;
        }
      });

      if (isValid !== -1) {
        message.type = 'ERROR';
        message.content = "Don't use email or phone number";
        // SINGLE EMIT: Error message broadcast to room only (no client.emit or this.io.emit)
        this.io.to(message.chatId).emit('message', JSON.stringify(message));
        return;
      }

      // Block prohibited words from being sent; show warning message in chat instead.
      const prohibitedMatches = await this.chatService.detectProhibitedWordsForMessage(
        message.senderId,
        message.content,
      );
      if (prohibitedMatches.length > 0) {
        await this.chatService.createProhibitedWordAlert(
          message.chatId,
          message.senderId,
          prohibitedMatches,
        );

        const warningMessage = {
          id: `warning-${Date.now()}`,
          chatId: message.chatId,
          senderId: 'system-monitor',
          content: 'Your message was blocked because it violates community guidelines. Please edit and try again.',
          type: 'MONITER',
          createdAt: new Date().toISOString(),
          read: true,
        };
        this.io.to(message.chatId).emit('message', JSON.stringify(warningMessage));
        return;
      }

      // CRITICAL: Ensure chat room exists before saving message
      // Check if chat room exists, create if missing
      let chatRoom;
      try {
        // Try to find existing chat room
        const existingChat = await this.db.chat.findUnique({
          where: { id: message.chatId },
          include: {
            user: { select: { id: true } },
            seller: { select: { id: true } },
          },
        });

        if (!existingChat) {
          // Chat room doesn't exist - need userId and sellerId from message payload
          // Frontend should send userId and sellerId when sending first message
          if (!message.userId || !message.sellerId) {
            console.error('❌ Cannot create chat room: userId and sellerId required in message payload', {
              chatId: message.chatId,
              senderId: message.senderId,
              hasUserId: !!message.userId,
              hasSellerId: !!message.sellerId,
            });
            
            // Try to derive from existing messages in this chatId
            const existingMessages = await this.db.message.findMany({
              where: { chatId: message.chatId },
              select: { senderId: true },
              distinct: ['senderId'],
            });

            const participantIds = [...new Set(existingMessages.map(m => m.senderId))];
            
            if (participantIds.length >= 2) {
              // We have at least 2 participants, use them
              const userId = participantIds[0];
              const sellerId = participantIds[1];
              
              chatRoom = await this.chatService.createChatRoom(userId, sellerId, message.listingId);
            } else {
              throw new WsException('Cannot create chat room: userId and sellerId required. Please provide them in the message payload.');
            }
          } else {
            // Create chat room with provided userId and sellerId
            if (message.senderId !== message.userId && message.senderId !== message.sellerId) {
              throw new WsException('Sender is not a participant in this chat');
            }

            chatRoom = await this.chatService.createChatRoom(message.userId, message.sellerId, message.listingId);
          }
        } else {
          chatRoom = existingChat;
        }
      } catch (chatError) {
        console.error('❌ Error ensuring chat room exists:', chatError);
        throw new WsException(`Failed to ensure chat room exists: ${chatError instanceof Error ? chatError.message : 'Unknown error'}`);
      }

      // Save message to database (idempotent - will return existing if duplicate)
      let savedMessage;
      try {
        if (!chatRoom || (chatRoom.userId !== message.senderId && chatRoom.sellerId !== message.senderId)) {
          throw new WsException('Sender is not a participant in this chat');
        }

        savedMessage = await this.chatService.createMessage({
          chatId: message.chatId,
          senderId: message.senderId,
          content: message.content,
          type: message.type || 'TEXT',
          fileUrl: message.fileUrl || null,
        });
        
        message.id = savedMessage.id;
        message.createdAt = savedMessage.createdAt.toISOString();
        message.read = savedMessage.read;
        message.fileUrl = savedMessage.fileUrl || message.fileUrl;
        
      } catch (dbError) {
        console.error('❌ Error saving message to database:', dbError);
        throw new WsException('Failed to save message to database');
      }

      // CRITICAL: Broadcast ONLY to the specific room - SINGLE EMIT ONLY
      // DO NOT use client.emit() or this.io.emit() - only use this.io.to(chatId).emit()
      // This ensures the sender receives the message exactly once via room broadcast
      const messageString = JSON.stringify(message);
      
      // SINGLE EMIT: Broadcast to all clients in the room (including sender)
      // The sender is already in the room, so they receive it via this single room broadcast
      // NO additional emits - this is the ONLY emit for this message
      this.io.to(message.chatId).emit('message', messageString);

      // Emit to monitor room for admin/monitor dashboard updates
      this.io.to('monitor-room').emit('monitor:chat_updated', {
        chatRoomId: message.chatId,
        updatedAt: savedMessage.createdAt.toISOString(),
        lastMessage: {
          id: savedMessage.id,
          content: savedMessage.content,
          createdAt: savedMessage.createdAt.toISOString(),
          senderId: savedMessage.senderId,
        },
      });
      
      void this.emitMessageNotify(message.chatId, message.senderId);

      // Run post-save tasks without blocking message delivery
      void (async () => {
        const chatUpdate = await this.db.chat.update({
          where: { id: message.chatId },
          data: { updatedAt: new Date() },
        }).catch(err => {
          console.error('❌ Failed to update chat updatedAt:', err);
          return null;
        });

        // Check if this is a new chat (first message) and emit monitor:chat_created
        if (chatUpdate) {
          const chat = await this.db.chat.findUnique({
            where: { id: message.chatId },
            include: {
              messages: {
                select: { id: true },
                take: 1,
              },
            },
          });

          if (chat && chat.messages.length === 1) {
            this.io.to('monitor-room').emit('monitor:chat_created', {
              chatRoomId: message.chatId,
            });
          }
        }

        // Create notification for the recipient (not the sender)
        try {
          const chat = await this.db.chat.findUnique({
            where: { id: message.chatId },
            include: {
              user: { select: { id: true, first_name: true, last_name: true } },
              seller: { select: { id: true, first_name: true, last_name: true } },
            },
          });

          if (chat) {
            const recipientId = chat.userId === message.senderId ? chat.sellerId : chat.userId;
            const senderName = chat.userId === message.senderId
              ? `${chat.user.first_name || ''} ${chat.user.last_name || ''}`.trim() || 'User'
              : `${chat.seller.first_name || ''} ${chat.seller.last_name || ''}`.trim() || 'User';

            await this.db.notification.create({
              data: {
                userId: recipientId,
                title: 'New Message',
                message: `${senderName}: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`,
                type: 'message',
                read: false,
                link: `/chat?chatId=${message.chatId}&userId=${chat.userId}&sellerId=${chat.sellerId}`,
                chatId: message.chatId,
              },
            });

            this.io.to(`user:${recipientId}`).emit('new_notification', {
              type: 'message',
              chatId: message.chatId,
              messageId: message.id,
            });
          }
        } catch (notifError) {
          // Don't fail message creation if notification fails
          console.error('❌ Failed to create notification:', notifError);
        }
      })();
      
      // NOTE: Removed queueMessage call to prevent duplicate message saves
      // Message is already saved directly via createMessage() above
      // Queue system was causing duplicate messages in database
      // If queue functionality is needed later, ensure it checks for existing messages first
      // this.messageQueueService.queueMessage(message);
      
    } catch (error) {
      console.error('❌ Error in handleSendMessage:', error);
      throw new WsException(error instanceof Error ? error.message : 'Failed to send message');
    }
  }

  // Admin-specific handlers
  @SubscribeMessage('join:room:admin')
  handleJoinRoomAsAdmin(
    @MessageBody() { chatId }: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      client.join(chatId);
      this.io.to(chatId).emit('join:admin', JSON.stringify({
        adminJoined: true,
        message: 'An Admin Has Joined the Chat..',
      }));
    } catch (error) {
      throw new WsException('Failed to join as admin');
    }
  }

  @SubscribeMessage('message:send:admin')
  async handleSendAdminMessage(
    @MessageBody() message: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const socketUserId = (client as any).userId;
      const socketUserRole = (client as any).userRole;

      // Validate message
      if (!message.chatId || !message.senderId || !message.content) {
        throw new WsException('Invalid message format: chatId, senderId, and content are required');
      }

      if (!socketUserId || message.senderId !== socketUserId) {
        throw new WsException('Unauthorized sender');
      }

      if (!this.isStaffRole(socketUserRole)) {
        throw new WsException('Admin privileges required');
      }

      // CRITICAL: Ensure chat room exists
      let chatRoom;
      try {
        const existingChat = await this.db.chat.findUnique({
          where: { id: message.chatId },
          include: {
            user: { select: { id: true } },
            seller: { select: { id: true } },
          },
        });

        if (!existingChat) {
          throw new WsException('Chat room not found');
        }
        chatRoom = existingChat;
      } catch (chatError) {
        throw new WsException(`Failed to ensure chat room exists: ${chatError instanceof Error ? chatError.message : 'Unknown error'}`);
      }

      // Fetch admin user information
      let adminUser;
      try {
        adminUser = await this.db.user.findUnique({
          where: { id: message.senderId },
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_pic: true,
            role: true,
          },
        });

        if (!adminUser) {
          throw new WsException('Admin user not found');
        }
      } catch (userError) {
        throw new WsException('Failed to fetch admin user information');
      }

      // Save message to database
      let savedMessage;
      try {
        savedMessage = await this.chatService.createMessage({
          chatId: message.chatId,
          senderId: message.senderId,
          content: message.content,
          type: 'ADMIN',
          fileUrl: message.fileUrl || null,
        });
        
      } catch (dbError) {
        console.error('❌ Error saving admin message to database:', dbError);
        throw new WsException('Failed to save admin message to database');
      }

      // Prepare message payload with sender information
      const messagePayload = {
        id: savedMessage.id,
        chatId: message.chatId,
        senderId: message.senderId,
        content: savedMessage.content,
        type: 'ADMIN',
        createdAt: savedMessage.createdAt.toISOString(),
        read: savedMessage.read,
        fileUrl: savedMessage.fileUrl || null,
        sender: {
          id: adminUser.id,
          first_name: adminUser.first_name || '',
          last_name: adminUser.last_name || '',
          email: adminUser.email || '',
          profile_pic: adminUser.profile_pic || null,
          role: adminUser.role || 'ADMIN',
        },
      };

      // CRITICAL: Broadcast ONLY to the specific room - SINGLE EMIT ONLY
      const messageString = JSON.stringify(messagePayload);
      this.io.to(message.chatId).emit('message', messageString);
      
      // Emit to monitor room for admin/monitor dashboard updates
      this.io.to('monitor-room').emit('monitor:chat_updated', {
        chatRoomId: message.chatId,
        updatedAt: savedMessage.createdAt.toISOString(),
        lastMessage: {
          id: savedMessage.id,
          content: savedMessage.content,
          createdAt: savedMessage.createdAt.toISOString(),
          senderId: savedMessage.senderId,
        },
      });

      void this.emitMessageNotify(message.chatId, message.senderId);

      // Run post-save tasks without blocking message delivery
      void (async () => {
        // Update chat room's updatedAt timestamp
        await this.db.chat.update({
          where: { id: message.chatId },
          data: { updatedAt: new Date() },
        }).catch(err => {
          console.error('❌ Failed to update chat updatedAt:', err);
        });

        // Create notification for recipients (not the admin)
        try {
          const recipientId = chatRoom.userId === message.senderId ? chatRoom.sellerId : chatRoom.userId;
          const adminName = `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() || 'Admin';

          await this.db.notification.create({
            data: {
              userId: recipientId,
              title: 'Admin Message',
              message: `${adminName}: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`,
              type: 'message',
              read: false,
              link: `/chat?chatId=${message.chatId}&userId=${chatRoom.userId}&sellerId=${chatRoom.sellerId}`,
              chatId: message.chatId,
            },
          });

          this.io.to(`user:${recipientId}`).emit('new_notification', {
            type: 'message',
            chatId: message.chatId,
            messageId: savedMessage.id,
          });
        } catch (notifError) {
          // Don't fail message creation if notification fails
          console.error('❌ Failed to create notification:', notifError);
        }
      })();
    } catch (error) {
      console.error('❌ Error in handleSendAdminMessage:', error);
      throw new WsException(error instanceof Error ? error.message : 'Failed to send admin message');
    }
  }

  // Offer handlers
  @SubscribeMessage('offer:user')
  async handleOfferUser(
    @MessageBody() message: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const socketUserId = (client as any).userId;
      if (!socketUserId || message.senderId !== socketUserId) {
        throw new WsException('Unauthorized sender');
      }
      message.type = 'OFFER';
      await this.chatService.updateOfferStatus(message.chatId, true);
      this.messageQueueService.queueMessage(message);
      // SINGLE EMIT: Offer message - only room broadcast, no client.emit or this.io.emit
      console.log('📤 EMIT offer message (SINGLE):', message.id || 'no-id', 'to room:', message.chatId);
      this.io.to(message.chatId).emit('message', JSON.stringify(message));
    } catch (error) {
      throw new WsException('Failed to process offer');
    }
  }

  @SubscribeMessage('offer:user:response')
  async handleOfferUserResponse(
    @MessageBody() message: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const socketUserId = (client as any).userId;
      if (!socketUserId || message.senderId !== socketUserId) {
        throw new WsException('Unauthorized sender');
      }
      message.type = 'OFFER';
      const response = message.response === 'true' ? true : false;
      await this.chatService.updateOfferStatus(message.chatId, response);
      this.messageQueueService.queueMessage(message);
      // SINGLE EMIT: Offer response message - only room broadcast, no client.emit or this.io.emit
      console.log('📤 EMIT offer response message (SINGLE):', message.id || 'no-id', 'to room:', message.chatId);
      this.io.to(message.chatId).emit('message', JSON.stringify(message));
    } catch (error) {
      throw new WsException('Failed to process offer response');
    }
  }

  // Video call handlers
  @SubscribeMessage('video:register')
  handleRegisterUserForVideoCall(
    @MessageBody() message: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const socketUserId = (client as any).userId;
    if (!socketUserId || socketUserId !== message.userId) {
      throw new WsException('Unauthorized registration');
    }

    // Join a room for this user ID so we can send video call notifications
    const userRoom = `user:${message.userId}`;
    client.join(userRoom);
    
    // Verify the room membership
    const room = this.io.sockets.adapter.rooms.get(userRoom);
    const clientCount = room?.size || 0;
    
    console.log('📹 User registered for video call:', message.userId, 'joined room:', userRoom, 'clients in room:', clientCount);
    
    // Send confirmation to client
    client.emit('video:registered', { userId: message.userId, room: userRoom, success: true });
  }

  @SubscribeMessage('video:call-user')
  async handleCallUserForVideoCall(
    @MessageBody() message: { from: string; to: string; channelName: string; chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const socketUserId = (client as any).userId;
    if (!socketUserId || socketUserId !== message.from) {
      throw new WsException('Unauthorized caller');
    }

    if (!message.chatId) {
      throw new WsException('chatId is required for video calls');
    }

    const chat = await this.db.chat.findUnique({
      where: { id: message.chatId },
      select: { userId: true, sellerId: true },
    });

    if (!chat || ![chat.userId, chat.sellerId].includes(message.from) || ![chat.userId, chat.sellerId].includes(message.to)) {
      throw new WsException('Unauthorized video call participants');
    }

    // Get the target user's room
    const targetUserRoom = `user:${message.to}`;
    
    console.log('📞 Video call request received:', {
      from: message.from,
      to: message.to,
      targetRoom: targetUserRoom,
      chatId: message.chatId,
    });
    
    // Check if target user is online (has joined their room)
    const room = this.io.sockets.adapter.rooms.get(targetUserRoom);
    
    // Also check if user is in the chat room as fallback
    const chatRoom = message.chatId ? this.io.sockets.adapter.rooms.get(message.chatId) : null;
    
    console.log('🔍 Room check:', {
      targetRoom: targetUserRoom,
      roomExists: !!room,
      clientCount: room?.size || 0,
      chatRoomExists: !!chatRoom,
      chatRoomClientCount: chatRoom?.size || 0,
      allUserRooms: Array.from(this.io.sockets.adapter.rooms.keys()).filter(r => r.startsWith('user:')),
    });
    
    if (room && room.size > 0) {
      console.log('📞 Sending video call request to user:', message.to, 'in room:', targetUserRoom, 'to', room.size, 'socket(s)');
      // Emit to all sockets in the target user's room
      this.io.to(targetUserRoom).emit('video:incoming-call', {
        from: message.from,
        to: message.to,
        channelName: message.channelName,
        chatId: message.chatId,
      });
      console.log('✅ Video call request sent to', room.size, 'socket(s) in user room');
      
      // Also emit to chat room as backup (in case user is listening there)
      if (message.chatId && chatRoom && chatRoom.size > 0) {
        this.io.to(message.chatId).emit('video:incoming-call', {
          from: message.from,
          to: message.to,
          channelName: message.channelName,
          chatId: message.chatId,
        });
        console.log('✅ Video call request also sent to', chatRoom.size, 'socket(s) in chat room');
      }
    } else {
      console.log('⚠️ Target user is offline or not registered:', message.to, 'room:', targetUserRoom);
      
      // Create missed call message immediately if user is offline
      if (message.chatId) {
        try {
          const missedCallMessage = await this.chatService.createMessage({
            chatId: message.chatId,
            senderId: message.to, // The offline user
            content: JSON.stringify({
              type: 'missed_video_call',
              callerId: message.from,
              receiverId: message.to,
              timestamp: new Date().toISOString(),
              reason: 'user_offline',
            }),
            type: 'TEXT',
          });
          
          // Broadcast missed call message to chat room
          this.io.to(message.chatId).emit('message', JSON.stringify({
            id: missedCallMessage.id,
            chatId: message.chatId,
            content: missedCallMessage.content,
            senderId: missedCallMessage.senderId,
            type: missedCallMessage.type,
            createdAt: missedCallMessage.createdAt,
          }));
          
          console.log('✅ Missed call message created (user offline):', missedCallMessage.id);
        } catch (error) {
          console.error('❌ Error creating missed call message:', error);
        }
      }
      
      // Notify caller that user is offline
      client.emit('video:user-offline', { userId: message.to });
    }
  }

  @SubscribeMessage('video:accept-call')
  async handleAcceptCallForVideoCall(
    @MessageBody() message: { from: string; to: string; channelName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const socketUserId = (client as any).userId;
    if (!socketUserId || socketUserId !== message.from) {
      throw new WsException('Unauthorized accept');
    }
    const callerRoom = `user:${message.to}`;
    console.log('✅ Video call accepted, notifying caller:', message.to, 'in room:', callerRoom);
    
    // Notify the caller that the call was accepted
    this.io.to(callerRoom).emit('video:call-accepted', {
      from: message.from,
      to: message.to,
      channelName: message.channelName,
    });
  }

  @SubscribeMessage('video:reject-call')
  async handleRejectCallForVideoCall(
    @MessageBody() message: { from: string; to: string; chatId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const socketUserId = (client as any).userId;
    if (!socketUserId || socketUserId !== message.from) {
      throw new WsException('Unauthorized reject');
    }
    const callerRoom = `user:${message.to}`;
    console.log('❌ Video call rejected, notifying caller:', message.to);
    
    // Create missed call message in chat
    if (message.chatId) {
      try {
        const missedCallMessage = await this.chatService.createMessage({
          chatId: message.chatId,
          senderId: message.to, // The person who rejected (receiver)
          content: JSON.stringify({
            type: 'missed_video_call',
            callerId: message.from,
            receiverId: message.to,
            timestamp: new Date().toISOString(),
          }),
          type: 'TEXT',
        });
        
        // Broadcast missed call message to chat room
        this.io.to(message.chatId).emit('message', JSON.stringify({
          id: missedCallMessage.id,
          chatId: message.chatId,
          content: missedCallMessage.content,
          senderId: missedCallMessage.senderId,
          type: missedCallMessage.type,
          createdAt: missedCallMessage.createdAt,
        }));
        
        console.log('✅ Missed call message created:', missedCallMessage.id);
      } catch (error) {
        console.error('❌ Error creating missed call message:', error);
      }
    }
    
    // Notify the caller that the call was rejected
    this.io.to(callerRoom).emit('video:call-rejected', {
      from: message.from,
      to: message.to,
    });
  }

  @SubscribeMessage('video:end-call')
  async handleEndCallForVideoCall(
    @MessageBody() message: { from: string; to: string; chatId?: string; duration?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const socketUserId = (client as any).userId;
    if (!socketUserId || socketUserId !== message.from) {
      throw new WsException('Unauthorized end');
    }
    const targetRoom = `user:${message.to}`;
    console.log('📴 Video call ended, notifying:', message.to, 'duration:', message.duration, 'chatId:', message.chatId);
    
    // Notify the other party that the call ended
    this.io.to(targetRoom).emit('video:call-ended', { 
      from: message.from,
      to: message.to,
      duration: message.duration,
    });
    
    // If call was connected and had duration, create a call completed message
    if (message.chatId && message.duration && message.duration > 0) {
      try {
        const callCompletedMessage = await this.chatService.createMessage({
          chatId: message.chatId,
          senderId: message.from, // The person who ended the call
          content: JSON.stringify({
            type: 'video_call_completed',
            callerId: message.from,
            receiverId: message.to,
            duration: message.duration,
            timestamp: new Date().toISOString(),
          }),
          type: 'TEXT',
        });
        
        // Broadcast call completed message to chat room
        this.io.to(message.chatId).emit('message', JSON.stringify({
          id: callCompletedMessage.id,
          chatId: message.chatId,
          content: callCompletedMessage.content,
          senderId: callCompletedMessage.senderId,
          type: callCompletedMessage.type,
          createdAt: callCompletedMessage.createdAt,
        }));
        
        console.log('✅ Call completed message created:', callCompletedMessage.id, 'duration:', message.duration);
      } catch (error) {
        console.error('❌ Error creating call completed message:', error);
      }
    }
    
    // If call was connected and had duration, we could log it (optional)
    if (message.duration && message.duration > 0) {
      console.log('📞 Call completed with duration:', message.duration, 'seconds');
    }
  }

  @SubscribeMessage('video:media-status')
  async handleMediaStatusForVideoCall(
    @MessageBody() message: { to: string; from: string; mic?: boolean; camera?: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const socketUserId = (client as any).userId;
    if (!socketUserId || socketUserId !== message.from) {
      throw new WsException('Unauthorized media status');
    }
    const targetRoom = `user:${message.to}`;
    console.log('🎤 Video call media status update:', message);
    
    // Notify the other party about media status changes
    this.io.to(targetRoom).emit('video:media-status', {
      from: message.from,
      mic: message.mic,
      camera: message.camera,
    });
  }

  @SubscribeMessage('video:disconnect')
  async handleDisconnectForVideoCall(
    @MessageBody() message: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userRoom = `user:${message.userId}`;
    client.leave(userRoom);
    console.log('📹 User disconnected from video call room:', message.userId);
  }

  // WebRTC Signaling Handlers
  @SubscribeMessage('video:offer')
  async handleVideoOffer(
    @MessageBody() message: { from: string; to: string; offer: any },
    @ConnectedSocket() client: Socket,
  ) {
    const socketUserId = (client as any).userId;
    if (!socketUserId || socketUserId !== message.from) {
      throw new WsException('Unauthorized offer');
    }
    const targetRoom = `user:${message.to}`;
    console.log('📤 WebRTC offer from:', message.from, 'to:', message.to);
    
    // Forward the offer to the target user
    this.io.to(targetRoom).emit('video:offer', {
      from: message.from,
      to: message.to,
      offer: message.offer,
    });
  }

  @SubscribeMessage('video:answer')
  async handleVideoAnswer(
    @MessageBody() message: { from: string; to: string; answer: any },
    @ConnectedSocket() client: Socket,
  ) {
    const socketUserId = (client as any).userId;
    if (!socketUserId || socketUserId !== message.from) {
      throw new WsException('Unauthorized answer');
    }
    const targetRoom = `user:${message.to}`;
    console.log('📥 WebRTC answer from:', message.from, 'to:', message.to);
    
    // Forward the answer to the caller
    this.io.to(targetRoom).emit('video:answer', {
      from: message.from,
      to: message.to,
      answer: message.answer,
    });
  }

  @SubscribeMessage('video:ice-candidate')
  async handleIceCandidate(
    @MessageBody() message: { from: string; to: string; candidate: any },
    @ConnectedSocket() client: Socket,
  ) {
    const socketUserId = (client as any).userId;
    if (!socketUserId || socketUserId !== message.from) {
      throw new WsException('Unauthorized ICE candidate');
    }
    const targetRoom = `user:${message.to}`;
    console.log('🧊 ICE candidate from:', message.from, 'to:', message.to);
    
    // Forward the ICE candidate to the other peer
    this.io.to(targetRoom).emit('video:ice-candidate', {
      from: message.from,
      to: message.to,
      candidate: message.candidate,
    });
  }
}
