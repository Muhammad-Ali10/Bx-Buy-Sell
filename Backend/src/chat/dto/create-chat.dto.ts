import { z } from 'zod';
export const Messages = z.object({
  id: z.string().optional(),
  chatId: z.string().optional(),
  senderId: z.string().optional(),
  role: z.enum(['USER', 'SELLER', 'MONITER']),
  content: z.string().optional(),
  isEdited: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : false)),
  isDeleted: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : false)),
  flagged: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : false)),
});
export const ChatRoom = z.object({
  id: z.string().optional(),
  sellerId: z.string().optional(),
  userId: z.string().optional(),
  moniterId: z.string().optional(),
  Messages: z.array(Messages).optional(),
});

export type MessagesType = z.infer<typeof Messages>;
export type ChatRoomType = z.infer<typeof ChatRoom>;
