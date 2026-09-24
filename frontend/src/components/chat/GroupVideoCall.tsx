import { useEffect, useRef, useState } from "react";
import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { Mic, MicOff, PhoneOff, Users, Video, VideoOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A group video call: the team, the buyer and the seller of one conversation.
 *
 * Carried by Agora rather than the one-to-one WebRTC of VideoCall.tsx — three
 * people cannot each send their camera straight to everyone else without it
 * breaking down, and Agora's servers also get through the firewalls that left
 * some one-to-one calls stuck on "Connecting video…". The token comes from our
 * own server (the chat socket), which lets in only the people invited.
 *
 * Loaded on demand, so the SDK is not part of every page.
 */

export interface GroupCallCredentials {
  appId: string;
  channel: string;
  token: string;
  /** The user's own id: everyone's video is labelled by who they are. */
  uid: string;
}

export type GroupCallStatus = "ringing" | "joined" | "declined" | "left";

interface GroupVideoCallProps {
  credentials: GroupCallCredentials;
  /** Names for everyone who may appear, by user id. */
  people: Record<string, { name: string; picture?: string | null }>;
  /** Everyone invited and how they answered, so the host sees who is missing. */
  statuses?: Record<string, GroupCallStatus>;
  isHost: boolean;
  /** Pressed the red button. The screen has already let go of camera and mic. */
  onLeave: () => void;
}

AgoraRTC.setLogLevel(3); // warnings and errors only

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const STATUS_LABEL: Record<GroupCallStatus, string> = {
  ringing: "ringing…",
  joined: "in the call",
  declined: "declined",
  left: "left",
};

/** One person's picture: their video, or their initials while it is off. */
const Tile = ({
  name,
  track,
  muted,
  mirrored,
}: {
  name: string;
  track?: { play: (el: HTMLElement) => void; stop: () => void } | null;
  muted?: boolean;
  mirrored?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!track || !ref.current) return;
    track.play(ref.current);
    return () => track.stop();
  }, [track]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-800">
      {track ? (
        <div ref={ref} className={cn("h-full w-full", mirrored && "[&_video]:-scale-x-100")} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-700 text-2xl font-semibold text-white">
            {initials(name)}
          </span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
        {muted && <MicOff className="h-3 w-3" aria-label="Microphone off" />}
        {name}
      </div>
    </div>
  );
};

export const GroupVideoCall = ({ credentials, people, statuses = {}, isHost, onLeave }: GroupVideoCallProps) => {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);
  const camRef = useRef<ICameraVideoTrack | null>(null);
  const [remote, setRemote] = useState<IAgoraRTCRemoteUser[]>([]);
  const [localVideo, setLocalVideo] = useState<ICameraVideoTrack | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [phase, setPhase] = useState<"connecting" | "live" | "failed">("connecting");
  const [notice, setNotice] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    let usingProxy = false;
    let switching = false;
    let fallbackTimer: number | undefined;
    const tracks: Array<IMicrophoneAudioTrack | ICameraVideoTrack> = [];

    /*
     * Into the channel, directly or through Agora's proxy on TCP port 443.
     *
     * Some networks — offices, some mobile carriers — let the call's signalling
     * through and stop the media, so everyone joins and nobody sees anyone. The
     * proxy gets through wherever a web page does; it is the fallback rather
     * than the default because the direct route is quicker where it works.
     */
    const connect = async (proxy: boolean) => {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      if (proxy) client.startProxyServer(5);
      clientRef.current = client;
      // A fresh copy each time, so React sees the change.
      const refresh = () => {
        if (clientRef.current === client) setRemote([...client.remoteUsers]);
      };
      client.on("user-published", async (user, mediaType) => {
        try {
          await client.subscribe(user, mediaType);
        } catch (error) {
          console.warn("Group call: could not receive a participant", error);
          if (!usingProxy) void switchToProxy();
          return;
        }
        if (mediaType === "audio") user.audioTrack?.play();
        refresh();
      });
      client.on("user-unpublished", refresh);
      client.on("user-joined", refresh);
      client.on("user-left", refresh);
      await client.join(credentials.appId, credentials.channel, credentials.token, credentials.uid);
      if (tracks.length > 0) {
        await client.publish(tracks).catch((error) => console.error("Group call: publish", error));
      }
    };

    const switchToProxy = async () => {
      if (switching || usingProxy || cancelled) return;
      switching = true;
      usingProxy = true;
      window.clearTimeout(fallbackTimer);
      const previous = clientRef.current;
      previous?.removeAllListeners();
      await previous?.leave().catch(() => undefined);
      setRemote([]);
      setPhase("connecting");
      try {
        await connect(true);
        if (!cancelled) setPhase("live");
      } catch (error) {
        console.error("Group call: could not connect through the proxy", error);
        if (!cancelled) setPhase("failed");
      }
      switching = false;
    };

    (async () => {
      // Camera and microphone first, so either route can send them; each may
      // be refused on its own.
      try {
        micRef.current = await AgoraRTC.createMicrophoneAudioTrack();
        tracks.push(micRef.current);
      } catch {
        setMicOn(false);
        setNotice("Your microphone is blocked — others cannot hear you.");
      }
      try {
        camRef.current = await AgoraRTC.createCameraVideoTrack();
        tracks.push(camRef.current);
        setLocalVideo(camRef.current);
      } catch {
        setCamOn(false);
        setNotice((previous) => previous ?? "Your camera is blocked — others cannot see you.");
      }
      if (cancelled) {
        tracks.forEach((track) => track.close());
        return;
      }

      try {
        await connect(false);
      } catch (error) {
        // A network that stops the media can stop the direct join as well.
        console.warn("Group call: direct join failed, trying the proxy", error);
        usingProxy = true;
        try {
          await connect(true);
        } catch (proxyError) {
          console.error("Group call: could not join", proxyError);
          if (!cancelled) setPhase("failed");
          return;
        }
      }
      if (cancelled) return;
      setPhase("live");
      setJoinedAt(Date.now());

      // On the direct route, nothing leaving after a few seconds means the
      // network is holding it back: go round through the proxy.
      if (!usingProxy && tracks.length > 0) {
        fallbackTimer = window.setTimeout(() => {
          const client = clientRef.current;
          if (!client || usingProxy || cancelled) return;
          const sent =
            (client.getLocalAudioStats()?.sendBytes ?? 0) + (client.getLocalVideoStats()?.sendBytes ?? 0);
          if (sent === 0) void switchToProxy();
        }, 7000);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      tracks.forEach((track) => track.close());
      micRef.current = null;
      camRef.current = null;
      const client = clientRef.current;
      client?.removeAllListeners();
      void client?.leave();
    };
  }, [credentials.appId, credentials.channel, credentials.token, credentials.uid]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleMic = async () => {
    if (!micRef.current) return;
    await micRef.current.setEnabled(!micOn);
    setMicOn(!micOn);
  };
  const toggleCam = async () => {
    if (!camRef.current) return;
    await camRef.current.setEnabled(!camOn);
    setCamOn(!camOn);
  };

  const nameOf = (uid: string | number) => people[String(uid)]?.name || "Participant";
  const waitingFor = Object.entries(statuses).filter(([, status]) => status !== "joined");

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b0f19] text-white" role="dialog" aria-label="Group video call">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4" />
          <span className="font-semibold">Group video call</span>
          {phase === "live" && joinedAt && (
            <span className="text-white/60">· {formatDuration(Math.floor((now - joinedAt) / 1000))}</span>
          )}
        </div>
        {isHost && waitingFor.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2 text-xs">
            {waitingFor.map(([id, status]) => (
              <span key={id} className="rounded-full bg-white/10 px-3 py-1">
                {nameOf(id)} — {STATUS_LABEL[status]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
        {phase === "failed" ? (
          <div className="flex h-full items-center justify-center text-center text-white/80">
            Could not connect to the call. Please close it and try again.
          </div>
        ) : (
          <div
            className={cn(
              "mx-auto grid max-w-6xl gap-3",
              remote.length === 0 ? "grid-cols-1 max-w-3xl" : remote.length === 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            <Tile name={`${people[credentials.uid]?.name || "You"} (you)`} track={camOn ? localVideo : null} muted={!micOn} mirrored />
            {remote.map((user) => (
              <Tile key={String(user.uid)} name={nameOf(user.uid)} track={user.hasVideo ? user.videoTrack : null} muted={!user.hasAudio} />
            ))}
          </div>
        )}
        {phase === "connecting" && <p className="mt-4 text-center text-sm text-white/60">Connecting…</p>}
        {phase === "live" && remote.length === 0 && (
          <p className="mt-4 text-center text-sm text-white/60">
            {isHost ? "Waiting for the others to join…" : "Waiting for the others…"}
          </p>
        )}
        {notice && <p className="mt-2 text-center text-sm text-amber-300">{notice}</p>}
      </div>

      <div className="flex items-center justify-center gap-4 pb-6 pt-2">
        <button
          type="button"
          onClick={toggleMic}
          aria-label={micOn ? "Turn microphone off" : "Turn microphone on"}
          className={cn("flex h-12 w-12 items-center justify-center rounded-full", micOn ? "bg-white/15" : "bg-white text-black")}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={toggleCam}
          aria-label={camOn ? "Turn camera off" : "Turn camera on"}
          className={cn("flex h-12 w-12 items-center justify-center rounded-full", camOn ? "bg-white/15" : "bg-white text-black")}
        >
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={onLeave}
          aria-label={isHost ? "End the call for everyone" : "Leave the call"}
          title={isHost ? "End the call for everyone" : "Leave the call"}
          className="flex h-14 items-center gap-2 rounded-full bg-red-600 px-6 font-semibold hover:bg-red-700"
        >
          <PhoneOff className="h-5 w-5" />
          <span className="text-sm">{isHost ? "End for everyone" : "Leave"}</span>
        </button>
      </div>
    </div>
  );
};

export default GroupVideoCall;
