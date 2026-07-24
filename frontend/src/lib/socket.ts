import { io, Socket } from 'socket.io-client';

// Get API base URL from environment or use default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const WS_URL = import.meta.env.VITE_WS_URL || API_BASE_URL;

/**
 * Create a Socket.IO connection with proper configuration
 * @param options Additional socket options
 * @returns Socket instance
 */
export const createSocketConnection = (options?: {
  auth?: { token?: string };
  transports?: ('websocket' | 'polling')[];
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  timeout?: number;
  forceNew?: boolean;
  upgrade?: boolean;
}): Socket => {
  const authToken = localStorage.getItem('auth_token');
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  const heartbeatIntervalMs = 25_000;
  
  const socket = io(WS_URL, {
    // WebSocket-first: skips the HTTP long-polling handshake spam (nginx
    // proxies the upgrade). Polling remains as an automatic fallback.
    transports: options?.transports || ['websocket', 'polling'],
    reconnection: options?.reconnection !== undefined ? options.reconnection : true,
    reconnectionDelay: options?.reconnectionDelay || 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: options?.reconnectionAttempts || 10,
    timeout: options?.timeout || 10000,
    forceNew: options?.forceNew !== undefined ? options.forceNew : false,
    upgrade: options?.upgrade !== undefined ? options.upgrade : true,
    auth: {
      token: options?.auth?.token || authToken || undefined,
    },
    // Enable CORS
    withCredentials: false,
    // Auto connect
    autoConnect: true,
  });

  socket.on('connect', () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(() => {
      socket.emit('user:heartbeat', { ts: Date.now() });
    }, heartbeatIntervalMs);
  });

  socket.on('disconnect', () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  });

  socket.on('connect_error', () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  });

  return socket;
};

/**
 * Get the WebSocket URL
 */
export const getWebSocketUrl = (): string => {
  return WS_URL;
};

/**
 * Get the API base URL
 */
export const getApiBaseUrl = (): string => {
  return API_BASE_URL;
};

