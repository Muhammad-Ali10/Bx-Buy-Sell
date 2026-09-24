import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { PhoneOff, Users, Video } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/chat/ErrorBoundary";
import type { GroupCallCredentials, GroupCallStatus } from "@/components/chat/GroupVideoCall";
import { onPresenceSocket } from "@/lib/socket";
import { startRingTone, stopRingTone } from "@/lib/ringTone";
import { START_CALL_EVENT, type StartCallRequest } from "@/lib/calls";

// The Agora SDK is large; it loads only when a call opens.
const GroupVideoCall = lazy(() => import("@/components/chat/GroupVideoCall"));

type CallKind = "direct" | "group";

interface Invite {
  chatId: string;
  callId: string;
  kind: CallKind;
  from: string;
  people: Record<string, string>;
}

interface ActiveCall {
  chatId: string;
  callId: string;
  kind: CallKind;
  isHost: boolean;
  credentials: GroupCallCredentials;
  people: Record<string, string>;
  /** For the one who placed it: how each person invited has answered. */
  statuses: Record<string, GroupCallStatus>;
}

/** Asked once, on a click, so a call in a background tab can still be noticed. */
const askForNotifications = () => {
  try {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    /* not available */
  }
};

const notifyInBackground = (title: string, body: string) => {
  try {
    if (!document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
    const note = new Notification(title, { body, tag: "ex-call", requireInteraction: true, icon: "/favicon.png" });
    note.onclick = () => {
      window.focus();
      note.close();
    };
  } catch {
    /* not available */
  }
};

/** The signed-in person's name, as the rest of the app stores it. */
const ownName = (): string => {
  try {
    const user = JSON.parse(localStorage.getItem("user_data") || "{}");
    return `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
  } catch {
    return "";
  }
};

const ENDED_MESSAGE: Record<string, string> = {
  declined: "declined the call",
  no_answer: "did not answer",
};

/**
 * Every video call in the app, wherever the person is on the site.
 *
 * Calls used to live inside the chat window: someone reading a listing could
 * not be reached and was shown as offline, and the caller had to keep the chat
 * open. This sits at the root on the session's own connection. It rings on
 * every page (and as a browser notification when the tab is in the
 * background), places the calls that call buttons ask for, and shows the call
 * on top of whatever page the person is on.
 */
export const CallCenter = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [invite, setInviteState] = useState<Invite | null>(null);
  const [call, setCallState] = useState<ActiveCall | null>(null);
  // The handlers outlive the render that set them up.
  const inviteRef = useRef<Invite | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const setInvite = (next: Invite | null) => {
    inviteRef.current = next;
    setInviteState(next);
  };
  const setCall = (next: ActiveCall | null) => {
    callRef.current = next;
    setCallState(next);
  };

  useEffect(
    () =>
      onPresenceSocket((next) => {
        socketRef.current = next;
        setSocket(next);
      }),
    [],
  );

  // Calls asked for by a call button somewhere in the app.
  useEffect(() => {
    const onStart = (event: Event) => {
      const request = (event as CustomEvent<StartCallRequest>).detail;
      const current = socketRef.current;
      if (!request?.chatId) return;
      if (callRef.current || inviteRef.current) {
        toast.error("You are already in a call");
        return;
      }
      if (!current?.connected) {
        toast.error("Not connected yet — please try again in a moment");
        return;
      }
      askForNotifications();
      toast.loading("Calling…", { id: "call-start" });
      current.timeout(10_000).emit(
        "group-call:start",
        { chatId: request.chatId, to: request.to },
        (err: Error | null, reply: any) => {
          toast.dismiss("call-start");
          if (err) {
            toast.error("The chat server did not answer. Please try again.");
            return;
          }
          if (!reply?.ok) {
            toast.error(reply?.error || "Could not start the call");
            return;
          }
          setCall({
            chatId: request.chatId,
            callId: reply.callId,
            kind: reply.kind === "direct" ? "direct" : "group",
            isHost: true,
            credentials: { appId: reply.appId, channel: reply.channel, token: reply.token, uid: reply.uid },
            people: reply.people || {},
            statuses: Object.fromEntries((reply.invited || []).map((id: string) => [id, "ringing"])),
          });
        },
      );
    };
    window.addEventListener(START_CALL_EVENT, onStart);
    return () => window.removeEventListener(START_CALL_EVENT, onStart);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onIncoming = (data: Invite) => {
      if (callRef.current) return; // already in a call
      const incoming: Invite = {
        chatId: data.chatId,
        callId: data.callId,
        kind: data.kind === "direct" ? "direct" : "group",
        from: data.from,
        people: data.people || {},
      };
      setInvite(incoming);
      startRingTone();
      notifyInBackground(
        incoming.kind === "group" ? "Incoming group video call" : "Incoming video call",
        `${incoming.people[incoming.from] || "Someone"} is calling you`,
      );
    };
    // Answered or turned down in another tab: stop ringing here too.
    const onAnswered = (data: { callId: string }) => {
      if (inviteRef.current?.callId === data.callId && !callRef.current) {
        setInvite(null);
        stopRingTone();
      }
    };
    const onEnded = (data: { callId: string; reason?: string }) => {
      if (inviteRef.current?.callId === data.callId) {
        setInvite(null);
        stopRingTone();
      }
      const current = callRef.current;
      if (current?.callId === data.callId) {
        setCall(null);
        // Said to the one who placed a call between two people: why it ended.
        const other = Object.keys(current.statuses)[0];
        const why = data.reason ? ENDED_MESSAGE[data.reason] : undefined;
        if (current.isHost && current.kind === "direct" && why) {
          toast.info(`${current.people[other] || "They"} ${why}`);
        } else {
          toast.info("The call has ended");
        }
      }
    };
    const onParticipant = (data: { callId: string; userId: string; action: GroupCallStatus | "no_answer" }) => {
      const current = callRef.current;
      if (!current || current.callId !== data.callId) return;
      const status: GroupCallStatus = data.action === "no_answer" ? "declined" : data.action;
      setCall({ ...current, statuses: { ...current.statuses, [data.userId]: status } });
      const name = current.people[data.userId] || "Someone";
      if (data.action === "declined") toast.info(`${name} declined the call`);
      if (data.action === "no_answer") toast.info(`${name} did not answer`);
      if (data.action === "left") toast.info(`${name} left the call`);
    };
    socket.on("group-call:incoming", onIncoming);
    socket.on("group-call:answered", onAnswered);
    socket.on("group-call:ended", onEnded);
    socket.on("group-call:participant", onParticipant);
    return () => {
      socket.off("group-call:incoming", onIncoming);
      socket.off("group-call:answered", onAnswered);
      socket.off("group-call:ended", onEnded);
      socket.off("group-call:participant", onParticipant);
    };
  }, [socket]);

  useEffect(() => () => stopRingTone(), []);

  const join = () => {
    const current = inviteRef.current;
    if (!current || !socket?.connected) {
      toast.error("Not connected — please try again in a moment");
      return;
    }
    stopRingTone();
    askForNotifications();
    socket.timeout(10_000).emit(
      "group-call:join",
      { chatId: current.chatId, callId: current.callId },
      (err: Error | null, reply: any) => {
        setInvite(null);
        if (err) {
          toast.error("The chat server did not answer. Please try again.");
          return;
        }
        if (!reply?.ok) {
          toast.error(reply?.error || "Could not join the call");
          return;
        }
        setCall({
          chatId: current.chatId,
          callId: current.callId,
          kind: reply.kind === "direct" ? "direct" : current.kind,
          isHost: false,
          credentials: { appId: reply.appId, channel: reply.channel, token: reply.token, uid: reply.uid },
          people: reply.people || current.people,
          statuses: {},
        });
      },
    );
  };

  const decline = () => {
    const current = inviteRef.current;
    stopRingTone();
    setInvite(null);
    if (current) socket?.emit("group-call:decline", { chatId: current.chatId, callId: current.callId });
  };

  const leave = () => {
    const current = callRef.current;
    setCall(null);
    if (current) socket?.emit("group-call:leave", { chatId: current.chatId, callId: current.callId });
  };

  if (invite && !call) {
    const caller = invite.people[invite.from] || "Someone";
    const others = Object.entries(invite.people)
      .filter(([id]) => id !== invite.from && invite.kind === "group")
      .map(([, name]) => name);
    const label = invite.kind === "group" ? "Incoming group video call" : "Incoming video call";
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 p-6">
        <div className="w-full max-w-sm rounded-3xl bg-[#0b0f19] p-8 text-center text-white shadow-2xl" role="dialog" aria-label={label}>
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#C6FE1F] text-black">
            {invite.kind === "group" ? <Users className="h-9 w-9" /> : <Video className="h-9 w-9" />}
          </div>
          <h2 className="text-2xl font-bold">{caller}</h2>
          <p className="mt-2 text-white/70">
            {invite.kind === "group"
              ? `invites you to a group video call${others.length > 0 ? ` with ${others.join(" and ")}` : ""}`
              : "is calling you"}
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button onClick={decline} variant="destructive" className="h-12 rounded-full px-6">
              <PhoneOff className="mr-2 h-5 w-5" /> Decline
            </Button>
            <Button onClick={join} className="h-12 rounded-full bg-green-600 px-6 hover:bg-green-700">
              <Video className="mr-2 h-5 w-5" /> {invite.kind === "group" ? "Join" : "Answer"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!call) return null;

  const people = Object.fromEntries(Object.entries(call.people).map(([id, name]) => [id, { name }]));
  // Everyone else may know the team as "EX-Support"; you see your own name.
  const self = ownName();
  if (self) people[call.credentials.uid] = { name: self };
  return (
    <ErrorBoundary
      fallback={
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black text-white">
          <div className="p-6 text-center">
            <p className="mb-6">There was an error in the call.</p>
            <button onClick={leave} className="rounded-full bg-red-600 px-6 py-3 font-semibold">
              End call
            </button>
          </div>
        </div>
      }
    >
      <Suspense fallback={<div className="fixed inset-0 z-[60] bg-[#0b0f19]" />}>
        <GroupVideoCall
          credentials={call.credentials}
          people={people}
          statuses={call.statuses}
          isHost={call.isHost}
          kind={call.kind}
          onLeave={leave}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

export default CallCenter;
