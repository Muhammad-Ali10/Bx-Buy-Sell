import { useEffect, useRef, useState, useCallback } from "react";
import { PhoneOff, Video, VideoOff, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Socket } from "socket.io-client";

interface VideoCallProps {
  socket: Socket | null;
  fromUserId: string;
  toUserId: string;
  otherUser?: {
    first_name?: string;
    last_name?: string;
    profile_pic?: string;
  };
  isIncoming?: boolean;
  callStatus: 'calling' | 'ringing' | 'connected' | 'ended';
  onEndCall: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  callStartTime?: Date | null;
}

export const VideoCall = ({
  socket,
  fromUserId,
  toUserId,
  otherUser,
  isIncoming = false,
  callStatus,
  onEndCall,
  onAccept,
  onReject,
  callStartTime,
}: VideoCallProps) => {
  // CRITICAL: Log render state to debug accept button visibility
  const shouldShowAcceptButton = isIncoming === true && callStatus === 'ringing' && !!onAccept;
  console.log('VideoCall: Component rendering', { 
    fromUserId,
    toUserId,
    callStatus,
    isIncoming,
    hasSocket: !!socket,
    shouldShowAcceptButton,
    hasOnAccept: !!onAccept,
    note: isIncoming === false ? 'OUTGOING CALL - Accept button MUST NOT show' : 
          callStatus !== 'ringing' ? 'Not ringing - Accept button MUST NOT show' :
          'Incoming and ringing - Accept button CAN show'
  });

  // Refs for video elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  // Refs for WebRTC
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const initializingRef = useRef<boolean>(false); // Prevent multiple simultaneous initialization attempts
  const offerCreatedRef = useRef<boolean>(false); // Track if offer has been created to prevent duplicates
  /**
   * Route details that arrived before they could be used.
   *
   * The two sides send each other every way they might be reached, and those
   * cannot be handed to the browser until it knows what the other side
   * proposed. They used to be thrown away when they came too early — the code
   * even said "will add when ready" and then dropped them — and a call whose
   * only workable route happened to arrive first simply never connected.
   */
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  /** True while an offer of ours is waiting for an answer. */
  const makingOfferRef = useRef(false);
  /** Resolves when the camera has finished opening, for whoever asked second. */
  const openingCameraRef = useRef<Promise<void> | null>(null);
  
  // Use refs to store latest values for handlers (defined early so they can be used in functions)
  const toUserIdRef = useRef(toUserId);
  const fromUserIdRef = useRef(fromUserId);
  const socketRefForHandlers = useRef(socket);
  const isIncomingRef = useRef(isIncoming); // Track isIncoming to prevent accept button from showing incorrectly
  
  // Update refs when values change
  useEffect(() => {
    toUserIdRef.current = toUserId;
    fromUserIdRef.current = fromUserId;
    socketRefForHandlers.current = socket;
    isIncomingRef.current = isIncoming;
    console.log('📊 VideoCall: Refs updated', { isIncoming, isIncomingRef: isIncomingRef.current });
  }, [toUserId, fromUserId, socket, isIncoming]);
  
  // State
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [localStreamActive, setLocalStreamActive] = useState(false);
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Initializing...');
  /**
   * The other side's video has not arrived, and by now it probably will not.
   *
   * Until this, a call that could not find a route showed "Connecting video…"
   * for as long as the caller was willing to wait — no message, no way to try
   * again, nothing to tell them whether to keep waiting.
   */
  const [connectingTooLong, setConnectingTooLong] = useState(false);
  /**
   * How long the call has been up, in seconds.
   *
   * The timer below has always counted, and has always thrown: nothing
   * declared this, so every tick raised "setCallDuration is not defined" in the
   * console and the call's length was never shown.
   */
  const [callDuration, setCallDuration] = useState(0);

  /*
   * Where the two browsers look for a way to reach each other.
   *
   * STUN only tells each side what its own public address is. Where both
   * networks are strict — an office firewall, mobile data — there is no direct
   * route to find, and the call sits on "Connecting video…" for ever. What is
   * missing then is a TURN server, which relays the call when nothing else
   * works. There is none yet; it is read from the environment so that setting
   * one up is a matter of configuration rather than code.
   */
  const turnUrls = String(import.meta.env.VITE_TURN_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      ...(turnUrls.length > 0
        ? [
            {
              urls: turnUrls,
              username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
              credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
            } as RTCIceServer,
          ]
        : []),
    ],
  };

  /** Keep a route detail until the browser is ready for it. */
  const rememberCandidate = (candidate: RTCIceCandidateInit) => {
    pendingCandidatesRef.current.push(candidate);
    console.log('🧊 VideoCall: Stored an ICE candidate for later', pendingCandidatesRef.current.length);
  };

  /** Hand over everything that was waiting, once the other side is known. */
  const flushPendingCandidates = async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription || pendingCandidatesRef.current.length === 0) return;
    const waiting = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    console.log('🧊 VideoCall: Adding', waiting.length, 'stored ICE candidate(s)');
    for (const candidate of waiting) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('⚠️ VideoCall: Could not add a stored ICE candidate:', error);
      }
    }
  };

  /*
   * Give the element the stream whenever both exist.
   *
   * The stream can arrive while a different screen is up — a call still
   * ringing — and the element it belongs to is then not on the page. It used
   * to be handed over once, at that moment, and never again: the stream was
   * running and the picture stayed black.
   */
  useEffect(() => {
    const video = localVideoRef.current;
    const stream = localStreamRef.current;
    if (!video || !stream || video.srcObject === stream) return;
    if (stream.getVideoTracks().length === 0) return;
    video.srcObject = stream;
    video.muted = true;
    video.play().catch((error) => console.warn('⚠️ VideoCall: Self-view would not play:', error));
    console.log('✅ VideoCall: Self-view attached to the element');
  }, [localStreamActive, isInitialized, callStatus, localVideoEnabled]);

  useEffect(() => {
    const video = remoteVideoRef.current;
    const stream = remoteStreamRef.current;
    if (!video || !stream || video.srcObject === stream) return;
    video.srcObject = stream;
    video.play().catch((error) => console.warn('⚠️ VideoCall: Remote video would not play:', error));
    console.log('✅ VideoCall: Remote stream attached to the element');
  }, [remoteStreamActive, callStatus, remoteVideoEnabled]);

  /*
   * Say something when nothing comes through.
   *
   * Twenty seconds is far longer than a working call needs and short enough
   * that nobody sits there wondering. The count starts again whenever the call
   * moves on, so a slow but successful connection is never accused.
   */
  useEffect(() => {
    if (remoteStreamActive || error || callStatus !== 'connected') {
      setConnectingTooLong(false);
      return;
    }
    const timer = setTimeout(() => setConnectingTooLong(true), 20000);
    return () => clearTimeout(timer);
  }, [remoteStreamActive, error, callStatus]);

  /**
   * Look for a route again, from the beginning.
   *
   * Both sides ask their browser to start the search over; the side that
   * placed the call also offers again, which is what carries the new routes
   * across.
   */
  const retryConnection = async () => {
    const pc = peerConnectionRef.current;
    setConnectingTooLong(false);
    if (!pc) return;
    try {
      pc.restartIce?.();
      if (!isIncomingRef.current) {
        offerCreatedRef.current = false;
        await createOffer();
      }
      console.log('🔄 VideoCall: Looking for a route again');
    } catch (error) {
      console.error('❌ VideoCall: Could not start again:', error);
    }
  };

  // Initialize local media stream
  const initializeLocalStream = async (retryAudioOnly = false) => {
    /*
     * Someone else asked for the camera first: wait for it, do not walk away.
     *
     * This used to return at once. The incoming offer then went on without a
     * camera, the answer was built with no tracks in it, and the caller sat
     * looking at "Connecting video…" while this side's camera opened seconds
     * later with nobody to tell.
     */
    if (initializingRef.current) {
      console.log('⏳ VideoCall: The camera is already opening; waiting for it');
      await openingCameraRef.current;
      return;
    }
    
    // If we already have a stream, don't reinitialize unless explicitly requested
    if (localStreamRef.current && !retryAudioOnly) {
      console.log('✅ VideoCall: Local stream already exists, skipping initialization');
      return;
    }
    
    initializingRef.current = true;
    // What anybody else asking for the camera meanwhile will wait on.
    let cameraReady: () => void = () => {};
    openingCameraRef.current = new Promise<void>((resolve) => {
      cameraReady = resolve;
    });
    
    try {
      console.log('📹 VideoCall: Requesting local media stream...', { 
        retryAudioOnly,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!(navigator.mediaDevices?.getUserMedia),
        protocol: window.location.protocol,
        isSecure: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
        userAgent: navigator.userAgent,
        existingStream: !!localStreamRef.current
      });
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        /**
         * Blame the connection, not the browser.
         *
         * A browser hands out the camera only to a secure page — https, or
         * localhost. On anything else it does not merely refuse: it removes
         * `navigator.mediaDevices` altogether. Chrome, Firefox and Edge all do
         * this, so reading the gap as "your browser is too old" told someone on
         * the newest Chrome to go and find a modern browser, and no amount of
         * changing browsers ever fixed it.
         *
         * The distinction matters here because the app is served over http on
         * the local network, which is exactly how a second device joins a call
         * to test one.
         */
        const secureContext =
          window.isSecureContext ||
          window.location.protocol === 'https:' ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';

        const errorMsg = secureContext
          ? 'getUserMedia is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.'
          : `Video calls need a secure connection. This page is served over ${window.location.protocol}//, and browsers only allow camera and microphone access over https (or on localhost).`;

        console.error('❌ VideoCall:', errorMsg, { secureContext, origin: window.location.origin });
        throw new Error(errorMsg);
      }
      
      // Check permissions if available (not all browsers support this)
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log('📹 VideoCall: Permission status:', {
            camera: cameraPermission.state,
            microphone: microphonePermission.state
          });
          
          if (cameraPermission.state === 'denied' || microphonePermission.state === 'denied') {
            console.warn('⚠️ VideoCall: Permissions are denied, but will try anyway (user may have granted via prompt)');
          }
        }
      } catch (permError) {
        // Permissions API not supported or failed, continue anyway
        console.log('ℹ️ VideoCall: Permissions API not available, continuing...');
      }

      let stream: MediaStream;
      
      // Try with basic constraints first (less strict)
      const basicConstraints = {
        video: retryAudioOnly ? false : true, // Start with simple true instead of detailed constraints
        audio: true, // Start with simple true instead of detailed constraints
      };
      
      // Try to get both video and audio first, fallback to audio-only if video fails
      try {
        console.log('📹 VideoCall: Attempting to get media with constraints:', basicConstraints);
        stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
        console.log('✅ VideoCall: Successfully got media stream', {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          videoTrackInfo: stream.getVideoTracks().map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })),
          audioTrackInfo: stream.getAudioTracks().map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState }))
        });
      } catch (videoError: any) {
        console.error('❌ VideoCall: Error getting media:', {
          name: videoError.name,
          message: videoError.message,
          constraint: videoError.constraint,
          stack: videoError.stack
        });
        
        // If video fails but we haven't tried audio-only yet, retry with audio only
        if (!retryAudioOnly) {
          console.log('⚠️ VideoCall: Video access failed, trying audio-only...');
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: true,
            });
            console.log('✅ VideoCall: Got audio-only stream');
            setLocalVideoEnabled(false); // Disable video toggle since we don't have video
          } catch (audioError: any) {
            console.error('❌ VideoCall: Audio also failed:', {
              name: audioError.name,
              message: audioError.message,
              constraint: audioError.constraint
            });
            throw audioError; // Re-throw if audio also fails
          }
        } else {
          throw videoError; // Re-throw if it's not a permission/device error
        }
      }

      localStreamRef.current = stream;
      setLocalStreamActive(true);
      console.log('✅ VideoCall: Got local media stream');

      /*
       * A connection built before this has nothing of ours in it.
       *
       * That is how a call ended up established with one side blank: the offer
       * arrived first, the connection was made without a camera, and when the
       * camera opened its tracks went nowhere. Adding them here is what starts
       * the exchange again — `onnegotiationneeded` sends the new offer.
       */
      const connection = peerConnectionRef.current;
      if (connection) {
        const senders = connection.getSenders();
        for (const track of stream.getTracks()) {
          if (track.readyState !== 'live') continue;
          if (senders.some((sender) => sender.track === track)) continue;
          try {
            connection.addTrack(track, stream);
            console.log('✅ VideoCall: Added a late local track:', track.kind);
          } catch (addError) {
            console.warn('⚠️ VideoCall: Could not add a late track:', addError);
          }
        }
      }

      /*
       * The camera is open; that is what "initialized" means.
       *
       * This used to be said only when the little self-view happened to be on
       * screen at that very moment. While a call was still ringing it was not,
       * so the camera opened, the call went ahead — and the self-view showed
       * "Loading camera…" for the rest of it, because nothing ever said
       * otherwise. Putting the picture into the element is a separate job, done
       * by the effect below whenever both exist.
       */
      setIsInitialized(true);
      if (localVideoRef.current && stream.getVideoTracks().length > 0) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // Mute local to prevent echo
        await localVideoRef.current.play().catch((playError) =>
          console.warn('⚠️ VideoCall: Local video would not play:', playError),
        );
        console.log('✅ VideoCall: Local video playing');
      } else if (stream.getVideoTracks().length === 0) {
        console.log('✅ VideoCall: Audio-only mode (no video)');
      }
      
      // Clear any previous errors
      setError(null);
      initializingRef.current = false;
      cameraReady();
    } catch (error: any) {
      initializingRef.current = false;
      cameraReady();
      console.error('❌ VideoCall: Error accessing media:', {
        name: error.name,
        message: error.message,
        constraint: error.constraint,
        stack: error.stack,
        protocol: window.location.protocol,
        isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      });
      
      let errorMessage = 'Failed to access camera/microphone.';
      let detailedMessage = '';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Camera/microphone permission denied.';
        detailedMessage = 'Please check your browser permissions. Click the lock icon in the address bar and ensure camera and microphone are allowed.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera or microphone found.';
        detailedMessage = 'Please connect a camera and/or microphone device and try again.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Camera/microphone is being used by another application.';
        detailedMessage = 'Please close any other applications using your camera/microphone (Zoom, Teams, etc.) and try again.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera/microphone constraints not supported.';
        detailedMessage = 'Your device may not support the requested video/audio settings. Trying with basic settings...';
        // Try again with even simpler constraints
        setTimeout(() => {
          initializeLocalStream(true); // Try audio-only
        }, 1000);
        return;
      } else if (error.message?.includes('secure connection')) {
        // The browser is fine; the page is not. Said plainly, because the
        // person can act on this one — changing browsers never helps.
        errorMessage = 'Video calls need a secure connection.';
        detailedMessage =
          'Browsers only allow camera and microphone access over https, or on localhost. Open this site over https and try again.';
      } else if (error.message?.includes('not supported')) {
        errorMessage = 'Video calling not supported in this browser.';
        detailedMessage = 'Please use a modern browser like Chrome, Firefox, or Edge.';
      } else {
        // Generic error - provide more context
        errorMessage = `Failed to access camera/microphone: ${error.name || 'Unknown error'}`;
        detailedMessage = error.message || 'Please check your browser settings and try again.';
        
        // If on HTTP (not HTTPS) and not localhost, suggest HTTPS
        if (window.location.protocol === 'http:' && 
            window.location.hostname !== 'localhost' && 
            window.location.hostname !== '127.0.0.1') {
          detailedMessage += ' Note: Some browsers require HTTPS for camera/microphone access.';
        }
      }
      
      console.error('❌ VideoCall: Setting error:', errorMessage, detailedMessage);
      setError(errorMessage + (detailedMessage ? ` ${detailedMessage}` : ''));
    }
  };

  // Create peer connection
  const createPeerConnection = () => {
    try {
      // Don't create if already exists
      if (peerConnectionRef.current) {
        console.log('⚠️ VideoCall: Peer connection already exists, reusing');
        return peerConnectionRef.current;
      }
      
      console.log('🔌 VideoCall: Creating peer connection...');
      const peerConnection = new RTCPeerConnection(rtcConfiguration);
      peerConnectionRef.current = peerConnection;

      // Add local tracks to peer connection BEFORE setting remote description
      // This is critical for proper WebRTC negotiation
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            peerConnection.addTrack(track, localStreamRef.current!);
            console.log('✅ Added local track:', track.kind, track.id);
          } else {
            console.warn('⚠️ VideoCall: Track not ready, skipping:', track.kind, track.id);
          }
        });
      } else {
        console.warn('⚠️ VideoCall: No local stream available when creating peer connection');
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('📥 VideoCall: Received remote track:', event.track.kind, event.track.id);
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          setRemoteStreamActive(true);
          console.log('✅ VideoCall: Remote stream received, tracks:', event.streams[0].getTracks().map(t => `${t.kind}:${t.enabled ? 'on' : 'off'}`));
          
          // The audio track and the video track arrive separately, in the
          // same stream; attaching it twice interrupts the first play().
          if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            remoteVideoRef.current.play().catch(err => {
              console.error('❌ Error playing remote video:', err);
            });
            console.log('✅ VideoCall: Remote video element updated');
          } else {
            console.warn('⚠️ VideoCall: remoteVideoRef not available');
          }
        } else {
          console.warn('⚠️ VideoCall: Received track but no stream');
        }
      };

      /*
       * A track added after the first offer — a camera permission granted
       * slowly is enough — has to be offered again, or the other side is never
       * told about it and the call stays connected with nothing to show.
       */
      peerConnection.onnegotiationneeded = async () => {
        if (peerConnection !== peerConnectionRef.current) return;
        if (peerConnection.signalingState !== 'stable') return;
        // The first offer belongs to the call flow itself. This is only for
        // what changes afterwards, once the two sides have agreed once.
        if (!peerConnection.currentRemoteDescription) return;
        console.log('🔄 VideoCall: Something changed, offering again');
        try {
          makingOfferRef.current = true;
          await createOffer();
        } catch (error) {
          console.error('❌ VideoCall: Could not offer again:', error);
        } finally {
          makingOfferRef.current = false;
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const currentSocket = socketRefForHandlers.current || socket;
          if (currentSocket) {
            console.log('🧊 VideoCall: Sending ICE candidate', event.candidate.candidate.substring(0, 50));
            currentSocket.emit('video:ice-candidate', {
              from: fromUserIdRef.current,
              to: toUserIdRef.current,
              candidate: event.candidate.toJSON(),
            });
          } else {
            console.warn('⚠️ VideoCall: Cannot send ICE candidate - no socket');
          }
        } else {
          console.log('🧊 VideoCall: ICE candidate gathering complete (null candidate)');
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        const iceState = peerConnection.iceConnectionState;
        console.log('🔌 VideoCall: Connection state:', state, 'ICE state:', iceState);
        setConnectionStatus(state);
        
        if (state === 'connected') {
          setConnectionStatus('Connected');
          console.log('✅ Both users connected - video streams active');
          console.log('📊 VideoCall: Local tracks:', localStreamRef.current?.getTracks().map(t => `${t.kind}:${t.enabled ? 'on' : 'off'}`));
          console.log('📊 VideoCall: Remote tracks:', remoteStreamRef.current?.getTracks().map(t => `${t.kind}:${t.enabled ? 'on' : 'off'}`));
        } else if (state === 'disconnected' || state === 'failed') {
          setConnectionStatus('Connection lost');
          console.error('❌ VideoCall: Connection lost or failed');
        } else if (state === 'connecting') {
          setConnectionStatus('Connecting...');
        }
      };

      // Handle ICE connection state
      peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        console.log('🧊 VideoCall: ICE connection state:', iceState);
        
        if (iceState === 'connected' || iceState === 'completed') {
          console.log('✅ VideoCall: ICE connection established');
        } else if (iceState === 'failed') {
          console.error('❌ VideoCall: ICE connection failed');
          setError('Connection failed. Please check your network and try again.');
        } else if (iceState === 'disconnected') {
          console.warn('⚠️ VideoCall: ICE connection disconnected');
        }
      };
      
      // Handle ICE gathering state
      peerConnection.onicegatheringstatechange = () => {
        console.log('🧊 VideoCall: ICE gathering state:', peerConnection.iceGatheringState);
      };

      return peerConnection;
    } catch (error) {
      console.error('❌ VideoCall: Error creating peer connection:', error);
      setError('Failed to create peer connection');
      return null;
    }
  };

  // Create and send offer (caller) - made more robust to handle edge cases
  const createOffer = async () => {
    console.log('📤 VideoCall: createOffer called', {
      hasPeerConnection: !!peerConnectionRef.current,
      hasLocalStream: !!localStreamRef.current,
      hasSocket: !!(socketRefForHandlers.current || socket)
    });
    
    // Create peer connection if it doesn't exist
    if (!peerConnectionRef.current) {
      console.log('⚠️ VideoCall: Peer connection not found, creating now...');
      const pc = createPeerConnection();
      if (!pc) {
        console.error('❌ VideoCall: Failed to create peer connection');
        setError('Failed to establish connection');
        return;
      }
      // Give it a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const currentSocket = socketRefForHandlers.current || socket;
    if (!currentSocket) {
      console.warn('⚠️ VideoCall: No socket available, offer will be queued');
      // Don't return - still create offer, we'll try to send when socket connects
    }

    try {
      console.log('📤 VideoCall: Creating offer...');
      
      // Ensure local stream tracks are added before creating offer
      if (localStreamRef.current && peerConnectionRef.current) {
        const existingSenders = peerConnectionRef.current.getSenders();
        const tracks = localStreamRef.current.getTracks();
        
        // Check if all tracks are added and live
        const missingTracks = tracks.filter(track => 
          track.readyState === 'live' && !existingSenders.some(sender => sender.track === track)
        );
        
        if (missingTracks.length > 0) {
          console.log('📹 VideoCall: Adding missing local tracks before creating offer...', {
            missing: missingTracks.length,
            total: tracks.length
          });
          missingTracks.forEach(track => {
            try {
              peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
              console.log('✅ Added local track:', track.kind, track.id);
            } catch (error) {
              console.warn('⚠️ VideoCall: Failed to add track (might already exist):', error);
            }
          });
        } else {
          console.log('✅ VideoCall: All tracks already added to peer connection');
        }
      }
      
      if (!peerConnectionRef.current) {
        throw new Error('Peer connection not available after setup');
      }
      
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('✅ VideoCall: Offer created and local description set');
      
      // Send offer via socket
      if (currentSocket && currentSocket.connected) {
        currentSocket.emit('video:offer', {
          from: fromUserIdRef.current,
          to: toUserIdRef.current,
          offer: offer,
        });
        console.log('✅ VideoCall: Offer sent via WebSocket to:', toUserIdRef.current);
      } else if (currentSocket) {
        console.warn('⚠️ VideoCall: Socket not connected, waiting for connection...');
        // Wait for socket to connect and then send
        const sendOfferWhenConnected = () => {
          if (currentSocket.connected) {
            currentSocket.emit('video:offer', {
              from: fromUserIdRef.current,
              to: toUserIdRef.current,
              offer: offer,
            });
            console.log('✅ VideoCall: Offer sent after socket connected');
            currentSocket.off('connect', sendOfferWhenConnected);
          }
        };
        currentSocket.once('connect', sendOfferWhenConnected);
      } else {
        console.error('❌ VideoCall: Cannot send offer - no socket available');
      }
    } catch (error) {
      console.error('❌ VideoCall: Error creating offer:', error);
      setError('Failed to create offer: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Create and send answer (receiver) - kept for backward compatibility but logic moved to handleIncomingOffer
  const createAnswer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      console.error('❌ VideoCall: Cannot create answer - no peer connection');
      return;
    }
    
    if (!socket) {
      console.error('❌ VideoCall: Cannot create answer - no socket');
          return;
        }

    try {
      console.log('📥 VideoCall: Creating answer...');
      
      // Ensure local stream tracks are added before setting remote description
      if (localStreamRef.current && peerConnectionRef.current.getSenders().length === 0) {
        console.log('📹 VideoCall: Adding local tracks before creating answer...');
        localStreamRef.current.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
            console.log('✅ Added local track:', track.kind, track.id);
          }
        });
      }
      
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ VideoCall: Remote description set');
      await flushPendingCandidates();
      
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      console.log('✅ VideoCall: Answer created, sending to:', toUserIdRef.current);
      
      const currentSocket = socketRefForHandlers.current || socket;
      if (currentSocket) {
        currentSocket.emit('video:answer', {
          from: fromUserIdRef.current,
          to: toUserIdRef.current,
          answer: answer,
        });
        console.log('✅ VideoCall: Answer sent via WebSocket');
      } else {
        console.error('❌ VideoCall: Cannot send answer - no socket');
      }
      
      console.log('✅ VideoCall: Answer sent via WebSocket');
    } catch (error) {
      console.error('❌ VideoCall: Error creating answer:', error);
      setError('Failed to create answer');
    }
  };


  // Handle incoming offer - use useCallback for stable reference
  const handleIncomingOffer = useCallback(async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
    const currentToUserId = toUserIdRef.current;
    if (data.from !== currentToUserId) {
      console.log('⚠️ VideoCall: Offer from wrong user, ignoring', { from: data.from, expected: currentToUserId });
      return;
    }

    console.log('📥 VideoCall: Received offer from:', data.from);
    
    /*
     * Both sides offered at the same moment.
     *
     * Someone has to give way or neither settles. The side that answered the
     * call takes back its own offer and accepts the one that arrived; the side
     * that placed the call ignores it and waits for its answer.
     */
    const existing = peerConnectionRef.current;
    const collision =
      makingOfferRef.current || (existing != null && existing.signalingState !== 'stable');
    if (collision) {
      if (!isIncomingRef.current) {
        console.log('⚠️ VideoCall: Our offer is still in flight, ignoring theirs');
        return;
      }
      console.log('↩️ VideoCall: Taking back our offer and accepting theirs');
      await existing?.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit).catch(
        (error) => console.warn('⚠️ VideoCall: Could not take back our offer:', error),
      );
    }

    // Ensure we have local stream
    if (!localStreamRef.current) {
      console.log('📹 VideoCall: Initializing local stream for incoming offer');
      await initializeLocalStream(false);
    }
    
    // Create peer connection if it doesn't exist
    if (!peerConnectionRef.current) {
      console.log('🔌 VideoCall: Creating peer connection for incoming offer');
      createPeerConnection();
    }
    
    // Wait a bit for peer connection to be ready
    let retries = 0;
    while (!peerConnectionRef.current && retries < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (peerConnectionRef.current) {
      console.log('✅ VideoCall: Peer connection ready, creating answer');
      
      // Ensure local stream tracks are added before setting remote description
      if (localStreamRef.current && peerConnectionRef.current.getSenders().length === 0) {
        console.log('📹 VideoCall: Adding local tracks before creating answer...');
        localStreamRef.current.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
            console.log('✅ Added local track:', track.kind, track.id);
          }
        });
      }
      
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('✅ VideoCall: Remote description set');
        await flushPendingCandidates();
        
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        console.log('✅ VideoCall: Answer created, sending to:', currentToUserId);
        
        const currentSocket = socketRefForHandlers.current;
        if (currentSocket) {
          currentSocket.emit('video:answer', {
            from: fromUserIdRef.current,
            to: currentToUserId,
            answer: answer,
          });
          console.log('✅ VideoCall: Answer sent via WebSocket');
        } else {
          console.error('❌ VideoCall: Cannot send answer - no socket');
        }
      } catch (error) {
        console.error('❌ VideoCall: Error creating answer:', error);
        setError('Failed to create answer');
      }
    } else {
      console.error('❌ VideoCall: Peer connection not ready after waiting');
    }
  }, []); // Empty deps - using refs for latest values

  // Handle incoming answer - use useCallback for stable reference
  const handleIncomingAnswer = useCallback(async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
    const currentToUserId = toUserIdRef.current;
    if (data.from !== currentToUserId) {
      console.log('⚠️ VideoCall: Answer from wrong user, ignoring', { from: data.from, expected: currentToUserId });
      return;
    }
    
    console.log('📥 VideoCall: Received answer from:', data.from);
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('✅ VideoCall: Answer set as remote description');
        await flushPendingCandidates();
      } catch (error) {
        console.error('❌ VideoCall: Error setting remote description:', error);
      }
    } else {
      console.warn('⚠️ VideoCall: Received answer but no peer connection yet');
    }
  }, []); // Empty deps - using refs for latest values

  // Handle incoming ICE candidate - use useCallback for stable reference
  const handleIncomingIceCandidate = useCallback(async (data: { from: string; candidate: RTCIceCandidateInit }) => {
    const currentToUserId = toUserIdRef.current;
    if (data.from !== currentToUserId) {
      console.log('⚠️ VideoCall: ICE candidate from wrong user, ignoring', { from: data.from, expected: currentToUserId });
      return;
    }
    
    console.log('🧊 VideoCall: Received ICE candidate from:', data.from);
    
    // Not ready for it yet: keep it rather than lose it. Everything stored
    // here is handed over as soon as the other side's description is in.
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
      if (data.candidate) rememberCandidate(data.candidate);
      return;
    }
    
    if (data.candidate) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('✅ VideoCall: ICE candidate added successfully');
      } catch (error: any) {
        // Ignore error if candidate already added or connection is closed
        if (error.message?.includes('already') || error.message?.includes('closed')) {
          console.log('ℹ️ VideoCall: ICE candidate already added or connection closed');
        } else {
          console.error('❌ VideoCall: Error adding ICE candidate:', error);
        }
      }
    } else {
      console.log('🧊 VideoCall: Received null ICE candidate (gathering complete)');
    }
  }, []); // Empty deps - using refs for latest values

  // Set up WebSocket listeners for WebRTC signaling (always active when socket exists)
  useEffect(() => {
    if (!socket) {
      console.log('⚠️ VideoCall: No socket, skipping listener setup');
      return;
    }

    console.log('📡 VideoCall: Setting up WebRTC signaling listeners', { socketId: socket.id, toUserId });
    
    // Set up WebSocket listeners for WebRTC signaling
    socket.on('video:offer', handleIncomingOffer);
    socket.on('video:answer', handleIncomingAnswer);
    socket.on('video:ice-candidate', handleIncomingIceCandidate);

    return () => {
      console.log('🧹 VideoCall: Cleaning up WebRTC signaling listeners');
      socket.off('video:offer', handleIncomingOffer);
      socket.off('video:answer', handleIncomingAnswer);
      socket.off('video:ice-candidate', handleIncomingIceCandidate);
    };
  }, [socket, handleIncomingOffer, handleIncomingAnswer, handleIncomingIceCandidate]);

  // Reset offer created flag when call status changes to 'calling' (new call started)
  useEffect(() => {
    if (callStatus === 'calling' && !isIncoming) {
      // Reset offer flag for new outgoing calls
      offerCreatedRef.current = false;
      console.log('🔄 VideoCall: Call status changed to "calling" (outgoing), reset offer flag');
    }
  }, [callStatus, isIncoming]);

  // Initialize WebRTC when call status changes
  useEffect(() => {
    if (callStatus === 'ended') {
      console.log('⏸️ VideoCall: Call ended, skipping WebRTC setup');
      return;
    }
    
    // Note: We can start initializing even without socket - socket will be used for signaling later
    if (!socket) {
      console.log('⚠️ VideoCall: No socket yet, will initialize when socket is available', { callStatus });
      // Don't return - we can still initialize local stream
    }

    const setupWebRTC = async () => {
      console.log('🔧 VideoCall: Setting up WebRTC', { callStatus, isIncoming, fromUserId, toUserId });
      
      try {
        // Initialize local stream
        await initializeLocalStream(false);
        
        // Create peer connection if it doesn't exist
        if (!peerConnectionRef.current) {
          console.log('🔌 VideoCall: Creating new peer connection');
          const peerConnection = createPeerConnection();
          if (!peerConnection) {
            console.error('❌ VideoCall: Failed to create peer connection');
            setError('Failed to establish connection');
            return;
          }
        } else {
          console.log('✅ VideoCall: Peer connection already exists');
        }

        // NOTE: Offer creation for caller (when status becomes 'connected') is now handled
        // in a separate useEffect below. This ensures it triggers immediately when the status changes,
        // avoiding timing issues with setupWebRTC. We don't create the offer here anymore.
        
        // If receiver and call is connected (they accepted), wait for offer
        if (isIncoming && callStatus === 'connected') {
          console.log('📥 VideoCall: Receiver - peer connection ready, waiting for offer from caller');
          // The offer will be handled by handleIncomingOffer when it arrives
          // But we can also check if offer was already received
        }
      } catch (error) {
        console.error('❌ VideoCall: Error in setupWebRTC:', error);
        setError('Failed to initialize video call');
      }
    };

    setupWebRTC();
    // Note: createOffer is intentionally NOT in deps to avoid infinite loops
    // It uses refs internally so it always has the latest values
  }, [socket, callStatus, isIncoming, fromUserId, toUserId]);

  // SEPARATE useEffect to create offer immediately when caller's status becomes 'connected'
  // This is the PRIMARY mechanism for automatic offer creation - triggers when User B accepts
  useEffect(() => {
    // CRITICAL CHECK: Only for caller (outgoing call) when status becomes 'connected' (receiver accepted)
    const isCaller = !isIncoming && !isIncomingRef.current; // Double-check with ref
    const isConnected = callStatus === 'connected';
    const offerNotCreated = !offerCreatedRef.current;
    
    if (isCaller && isConnected && offerNotCreated) {
      console.log('🚀🚀🚀 AUTOMATIC OFFER CREATION TRIGGERED 🚀🚀🚀', {
        isIncoming,
        isIncomingRef: isIncomingRef.current,
        callStatus,
        offerAlreadyCreated: offerCreatedRef.current,
        reason: 'Caller call connected - receiver accepted, creating offer NOW'
      });
      offerCreatedRef.current = true;
      
      const createOfferNow = async () => {
        try {
          console.log('📤 VideoCall: Starting AUTOMATIC offer creation process...');
          
          // Step 1: Ensure peer connection exists
          if (!peerConnectionRef.current) {
            console.log('⚠️ VideoCall: No peer connection yet, creating one...');
            createPeerConnection();
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          // Step 2: Ensure local stream exists
          if (!localStreamRef.current) {
            console.log('⚠️ VideoCall: No local stream yet, initializing...');
            await initializeLocalStream(false);
          }
          
          // Step 3: Wait for both to be ready (with timeout)
          let attempts = 0;
          const maxAttempts = 30; // 3 seconds max
          while (attempts < maxAttempts && (!peerConnectionRef.current || !localStreamRef.current)) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
            if (attempts % 5 === 0) {
              console.log(`⏳ VideoCall: Waiting for setup... (${attempts}/${maxAttempts})`, {
                hasPC: !!peerConnectionRef.current,
                hasStream: !!localStreamRef.current
              });
            }
          }
          
          // Step 4: Create and send the offer
          if (peerConnectionRef.current && localStreamRef.current) {
            console.log('✅✅✅ VideoCall: READY - Creating and sending offer NOW ✅✅✅');
            await createOffer();
            console.log('🎉 VideoCall: Offer creation completed! Connection should establish automatically.');
          } else {
            console.error('❌ VideoCall: Setup incomplete after waiting', {
              hasPC: !!peerConnectionRef.current,
              hasStream: !!localStreamRef.current,
              attempts
            });
            offerCreatedRef.current = false; // Allow retry
            setError('Failed to initialize connection. Retrying...');
            
            // Retry once more after a delay
            setTimeout(async () => {
              if (!offerCreatedRef.current && peerConnectionRef.current && localStreamRef.current) {
                console.log('🔄 VideoCall: Retrying offer creation...');
                offerCreatedRef.current = true;
                await createOffer();
              }
            }, 1000);
          }
        } catch (error) {
          console.error('❌ VideoCall: Error in automatic offer creation:', error);
          offerCreatedRef.current = false; // Allow retry
          setError('Failed to create connection: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      };
      
      // Execute immediately - NO DELAY
      createOfferNow();
    } else if (isCaller && isConnected && !offerNotCreated) {
      console.log('ℹ️ VideoCall: Offer already created for this call');
    }
  }, [callStatus, isIncoming]); // Only depend on status and isIncoming

  // Cleanup when call ends
  useEffect(() => {
    if (callStatus === 'ended') {
      console.log('🧹 VideoCall: Call ended, cleaning up...');
      
      // Stop all local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 Stopped local track:', track.kind);
        });
        localStreamRef.current = null;
      }
      
      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        console.log('🔌 Closed peer connection');
        peerConnectionRef.current = null;
      }
      
      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      
      // Reset state
      setLocalStreamActive(false);
      setRemoteStreamActive(false);
      setIsInitialized(false);
      setError(null);
      initializingRef.current = false;
      offerCreatedRef.current = false; // Reset offer created flag
      
      console.log('✅ VideoCall: Cleanup complete');
    }
  }, [callStatus]);

  // Cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 VideoCall: Cleaning up...');
      
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('🧹 Stopped local track:', track.kind);
        });
        localStreamRef.current = null;
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
        console.log('🧹 Closed peer connection');
      }

      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };
  }, []);

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
          track.enabled = !localVideoEnabled;
        });
        setLocalVideoEnabled(!localVideoEnabled);
      
      // Notify other peer
      if (socket) {
        socket.emit('video:media-status', {
          from: fromUserId,
          to: toUserId,
          camera: !localVideoEnabled,
        });
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !localAudioEnabled;
        });
        setLocalAudioEnabled(!localAudioEnabled);
      
      // Notify other peer
      if (socket) {
        socket.emit('video:media-status', {
          from: fromUserId,
          to: toUserId,
          mic: !localAudioEnabled,
        });
      }
    }
  };

  // Handle media status updates from other peer
  useEffect(() => {
    if (!socket) return;

    const handleMediaStatus = (data: { from: string; mic?: boolean; camera?: boolean }) => {
      if (data.from !== toUserId) return;
      
      if (data.camera !== undefined) {
        setRemoteVideoEnabled(data.camera);
      }
      if (data.mic !== undefined) {
        setRemoteAudioEnabled(data.mic);
      }
    };

    socket.on('video:media-status', handleMediaStatus);
    return () => {
      socket.off('video:media-status', handleMediaStatus);
    };
  }, [socket, toUserId]);

  // Update call duration
  useEffect(() => {
    if (callStatus === 'connected' && callStartTime) {
      const interval = setInterval(() => {
        const duration = Math.floor((new Date().getTime() - callStartTime.getTime()) / 1000);
        setCallDuration(duration);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [callStatus, callStartTime]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (callStatus === 'calling') return 'Calling...';
    if (callStatus === 'ringing') return 'Ringing...';
    if (callStatus === 'connected') {
      if (callDuration > 0) {
        return formatDuration(callDuration);
      }
      return connectionStatus;
    }
    return '';
  };

  const otherUserName = (() => {
    try {
      if (otherUser) {
        const firstName = otherUser.first_name || '';
        const lastName = otherUser.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || 'User';
      }
      return 'User';
    } catch (e) {
      return 'User';
    }
  })();

  // Retry function for media access
  const handleRetryMediaAccess = async () => {
    setError(null);
    console.log('🔄 VideoCall: Retrying media access...');
    await initializeLocalStream(true); // Try audio-only if video fails
  };

  if (error) {
    // Set where the error is raised; read here so the screen can offer advice
    // the person can act on rather than the permission checklist.
    const needsSecureConnection = error.includes('secure connection');

    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white">
        <div className="text-center p-6 max-w-md">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <Video className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-xl mb-2 text-red-400 font-semibold">{error}</p>
            <p className="text-sm text-gray-400">
              {needsSecureConnection
                ? 'This is a restriction of the browser, not of the site — changing browsers will not help.'
                : 'Please check your browser permissions and device settings.'}
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={handleRetryMediaAccess}
              className="px-6 py-3 bg-blue-600 rounded-full hover:bg-blue-700 text-white font-semibold transition-colors"
            >
              Retry Access
            </button>
          <button 
            onClick={onEndCall}
              className="px-6 py-3 bg-red-600 rounded-full hover:bg-red-700 text-white font-semibold transition-colors"
          >
            End Call
          </button>
          </div>
          
          <div className="mt-6 text-xs text-gray-500">
            <p className="mb-2">Troubleshooting tips:</p>
            {/*
              A locked camera and an insecure page are different problems, and
              the permission tips are wasted on the second one: there is no
              icon in the address bar to click, because the browser never asked.
            */}
            <ul className="text-left space-y-1 list-disc list-inside">
              {needsSecureConnection ? (
                <>
                  <li>Open this site over https:// instead of http://</li>
                  <li>Camera access also works on localhost during development</li>
                  <li>Retrying on this address will not help until then</li>
                </>
              ) : (
                <>
                  <li>Check browser address bar for camera/mic icon</li>
                  <li>Allow permissions when prompted</li>
                  <li>Ensure no other app is using your camera/mic</li>
                  <li>Try refreshing the page</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
      {/* Remote Video (Full Screen) */}
      <div className="flex-1 relative bg-gray-900 overflow-hidden">
        {/* Remote video element - always render */}
        <video
        ref={remoteVideoRef} 
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${remoteStreamActive && callStatus === 'connected' && remoteVideoEnabled ? 'block' : 'hidden'}`}
        />
        
        {/* Show placeholder when video is off or not connected */}
        {(!remoteStreamActive || !remoteVideoEnabled || callStatus !== 'connected') && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="h-32 w-32 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-4">
              {otherUser?.profile_pic ? (
                <img 
                  src={otherUser.profile_pic} 
                  alt={otherUserName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-4xl text-white">
                  {(otherUserName[0] || 'U').toUpperCase()}
                </span>
              )}
              </div>
              <p className="text-white text-xl mb-2">{otherUserName}</p>
              <p className="text-gray-400">
                {callStatus === 'connected'
                  ? remoteVideoEnabled
                    ? connectingTooLong
                      ? 'The video is not coming through. This is usually the network at one end.'
                      : 'Connecting video...'
                    : 'Video off'
                  : getStatusText() || 'Connecting...'}
              </p>
              {connectingTooLong && callStatus === 'connected' && remoteVideoEnabled && (
                <Button
                  onClick={retryConnection}
                  className="mt-4 bg-white/10 hover:bg-white/20 text-white"
                >
                  Try again
                </Button>
              )}
            </div>
          </div>
        )}
        
        {callStatus !== 'connected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900">
            <div className="h-32 w-32 rounded-full bg-gray-700 flex items-center justify-center mb-4">
              {otherUser?.profile_pic ? (
                <img 
                  src={otherUser.profile_pic} 
                  alt={otherUserName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-4xl text-white">
                  {(otherUserName[0] || 'U').toUpperCase()}
                </span>
              )}
            </div>
            <h3 className="text-2xl font-semibold mb-2">{otherUserName}</h3>
            <p className="text-gray-400">{getStatusText()}</p>
          </div>
        )}
      </div>

      {/* Local Video Preview (Small, Top Right) */}
      <div className="absolute top-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg bg-gray-800 z-10">
        <video
        ref={localVideoRef} 
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm bg-gray-800">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
              <p>Loading camera...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="flex items-center justify-center gap-4">
          {/* Video Toggle */}
          <Button
            onClick={toggleVideo}
            variant="secondary"
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full",
              localVideoEnabled ? "bg-white/20 hover:bg-white/30" : "bg-red-600 hover:bg-red-700"
            )}
          >
            {localVideoEnabled ? (
              <Video className="h-6 w-6 text-white" />
            ) : (
              <VideoOff className="h-6 w-6 text-white" />
            )}
          </Button>

          {/* Audio Toggle */}
          <Button
            onClick={toggleAudio}
            variant="secondary"
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full",
              localAudioEnabled ? "bg-white/20 hover:bg-white/30" : "bg-red-600 hover:bg-red-700"
            )}
          >
            {localAudioEnabled ? (
              <Mic className="h-6 w-6 text-white" />
            ) : (
              <MicOff className="h-6 w-6 text-white" />
            )}
          </Button>

          {/* End Call / Reject */}
          <Button
            onClick={isIncoming && callStatus === 'ringing' ? onReject : onEndCall}
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
          >
            <PhoneOff className="h-7 w-7" />
          </Button>

          {/* Accept Button - ONLY for incoming calls that are STILL ringing */}
          {/* ABSOLUTE SAFEGUARDS: This button MUST NEVER appear for outgoing calls or connected calls */}
          {(() => {
            // MULTIPLE SAFETY CHECKS: All must pass for button to show
            const check1 = isIncoming === true; // Prop must be true
            const check2 = isIncomingRef.current === true; // Ref must also be true (double-check)
            const check3 = callStatus === 'ringing'; // Status must be ringing
            const check4 = !!onAccept; // Handler must exist
            
            // ALL checks must pass
            const shouldShow = check1 && check2 && check3 && check4;
            
            // Extensive logging for debugging
            if (shouldShow) {
              console.log('✅ VideoCall: Showing ACCEPT button - ALL checks passed', {
                isIncoming,
                isIncomingRef: isIncomingRef.current,
                callStatus,
                hasOnAccept: check4
              });
            } else {
              // Log why it's NOT showing
              const reasons = [];
              if (!check1) reasons.push('isIncoming prop is FALSE');
              if (!check2) reasons.push('isIncomingRef is FALSE');
              if (!check3) reasons.push(`callStatus is '${callStatus}' (not 'ringing')`);
              if (!check4) reasons.push('onAccept handler is missing');
              
              console.log('🚫 VideoCall: NOT showing accept button', {
                isIncoming,
                isIncomingRef: isIncomingRef.current,
                callStatus,
                hasOnAccept: check4,
                reasons: reasons.join(', '),
                note: 'This is CORRECT for outgoing calls or connected calls'
              });
            }
            
            // ABSOLUTE SAFETY CHECK: Never show if ANY check fails
            // Even if logic somehow allows it, prevent it if isIncoming is false
            if (shouldShow && (!isIncoming || !isIncomingRef.current)) {
              console.error('🚨🚨🚨 VideoCall: CRITICAL SAFETY CHECK FAILED! Preventing accept button from showing despite logic allowing it.');
              return false;
            }
            
            return shouldShow;
          })() && onAccept && (
            <Button
              onClick={onAccept}
              className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700"
              size="icon"
              aria-label="Accept video call"
              data-testid="accept-video-call-button"
            >
              <Video className="h-7 w-7 text-white" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
