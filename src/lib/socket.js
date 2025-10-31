"use client";
import { io } from "socket.io-client";

let socket = null;

export function getSocket(baseURL, auth) {
  if (!socket) {
    socket = io(baseURL, {
      transports: ["websocket"],
      withCredentials: true,
      auth, // e.g. { token: "JWT ..." }
    });
  }
  return socket;
}

export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
