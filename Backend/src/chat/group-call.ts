import { randomUUID } from 'crypto';
import { RtcRole, RtcTokenBuilder } from 'agora-token';

/**
 * Group video calls: the team, the buyer and the seller of one conversation.
 *
 * One-to-one calls send video straight between the two browsers, which does
 * not stretch to three — each person would have to send their camera to
 * everyone else. A group call goes through Agora instead: the browsers join a
 * channel on Agora's servers with a token only this server can mint, so
 * nobody reaches a call they were not let into.
 *
 * Only the team starts one (the same rule as a one-to-one call from the
 * admin's All Chats screen), and only the buyer and the seller of that
 * conversation are invited. The call goes on with whoever joins; whoever did
 * not is shown a missed call in the conversation.
 */

export interface GroupCall {
  callId: string;
  chatId: string;
  /** The Agora channel: fresh for every call, so an old token opens nothing. */
  channel: string;
  hostId: string;
  /** The socket the host started from; losing it ends the call. */
  hostSocketId?: string;
  invited: string[];
  /** Everyone who came in at some point, host excluded. */
  joined: Set<string>;
  /** Who is in the call right now, host excluded. */
  present: Set<string>;
  declined: Set<string>;
  startedAt: number;
}

export interface GroupCallSummary {
  durationSeconds: number;
  /** The host and everyone who joined. */
  participants: number;
  /** Invited, and never came in. */
  missed: string[];
}

export class GroupCallError extends Error {}

/** The calls running on this server, one per conversation at most. */
export class GroupCallRegistry {
  private readonly byChat = new Map<string, GroupCall>();

  get(chatId: string): GroupCall | undefined {
    return this.byChat.get(chatId);
  }

  start(
    chatId: string,
    hostId: string,
    participants: string[],
    options: { hostSocketId?: string; now?: number } = {},
  ): GroupCall {
    if (this.byChat.has(chatId)) {
      throw new GroupCallError('A group call is already running in this conversation');
    }
    const invited = [...new Set(participants.filter((id) => id && id !== hostId))];
    if (invited.length === 0) {
      throw new GroupCallError('There is nobody to invite to this call');
    }
    const callId = randomUUID();
    const call: GroupCall = {
      callId,
      chatId,
      channel: `gc_${callId.replace(/-/g, '')}`,
      hostId,
      hostSocketId: options.hostSocketId,
      invited,
      joined: new Set(),
      present: new Set(),
      declined: new Set(),
      startedAt: options.now ?? Date.now(),
    };
    this.byChat.set(chatId, call);
    return call;
  }

  /** Lets an invited person in. Throws when the call is gone or not theirs. */
  join(chatId: string, callId: string, userId: string): GroupCall {
    const call = this.live(chatId, callId);
    if (!call.invited.includes(userId)) {
      throw new GroupCallError('You were not invited to this call');
    }
    call.joined.add(userId);
    call.present.add(userId);
    call.declined.delete(userId);
    return call;
  }

  /** True when this changed anything: only someone invited who has not joined. */
  decline(chatId: string, callId: string, userId: string): boolean {
    const call = this.byChat.get(chatId);
    if (!call || call.callId !== callId) return false;
    if (!call.invited.includes(userId) || call.joined.has(userId)) return false;
    call.declined.add(userId);
    return true;
  }

  leave(chatId: string, callId: string, userId: string): GroupCall | undefined {
    const call = this.byChat.get(chatId);
    if (!call || call.callId !== callId) return undefined;
    call.present.delete(userId);
    return call;
  }

  /** Takes the call off the books and says how it went. */
  end(chatId: string, callId?: string, now = Date.now()):
    | { call: GroupCall; summary: GroupCallSummary }
    | undefined {
    const call = this.byChat.get(chatId);
    if (!call || (callId && call.callId !== callId)) return undefined;
    this.byChat.delete(chatId);
    return {
      call,
      summary: {
        durationSeconds: Math.max(0, Math.round((now - call.startedAt) / 1000)),
        participants: 1 + call.joined.size,
        missed: call.invited.filter((id) => !call.joined.has(id)),
      },
    };
  }

  /** The calls a socket was hosting, for when that socket goes away. */
  hostedBySocket(socketId: string): GroupCall[] {
    return [...this.byChat.values()].filter((call) => call.hostSocketId === socketId);
  }

  private live(chatId: string, callId: string): GroupCall {
    const call = this.byChat.get(chatId);
    if (!call || call.callId !== callId) {
      throw new GroupCallError('This call has already ended');
    }
    return call;
  }
}

/** Two hours: longer than any call, short enough that a leaked token dies. */
export const GROUP_CALL_TOKEN_SECONDS = 2 * 60 * 60;

/**
 * What a browser needs to enter the call's channel, or null when Agora is not
 * configured on this server.
 *
 * The person's user id is their Agora account, so the call screen can put a
 * name to every video without asking anyone.
 */
export function groupCallCredentials(
  channel: string,
  userId: string,
  env: { appId?: string; certificate?: string } = {
    appId: process.env.AGORA_APP_ID,
    certificate: process.env.AGORA_APP_CERTIFICATE,
  },
): { appId: string; token: string; channel: string; uid: string } | null {
  const appId = String(env.appId || '').trim();
  const certificate = String(env.certificate || '').trim();
  if (!appId || !certificate) return null;
  const token = RtcTokenBuilder.buildTokenWithUserAccount(
    appId,
    certificate,
    channel,
    userId,
    RtcRole.PUBLISHER,
    GROUP_CALL_TOKEN_SECONDS,
    GROUP_CALL_TOKEN_SECONDS,
  );
  return { appId, token, channel, uid: userId };
}
