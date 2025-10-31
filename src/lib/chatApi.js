const json = (r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

export function fetchUserRooms(apiBase, userId) {
  return fetch(`${apiBase}/chat/fetch/user/${userId}`, { cache: "no-store" }).then(json);
}
export function fetchSellerRooms(apiBase, sellerId) {
  return fetch(`${apiBase}/chat/fetch/seller/${sellerId}`, { cache: "no-store" }).then(json);
}
export function updateChatLabel(apiBase, { chatId, userId, label }) {
  const u = new URL(`${apiBase}/chat/update-label`);
  u.searchParams.set("chatId", chatId);
  u.searchParams.set("userId", userId);
  u.searchParams.set("label", label);
  return fetch(u.toString(), { method: "PUT" }).then(json);
}
export async function ensureRoom(apiBase, { userId, sellerId }) {
  try {
    const r = await fetch(`${apiBase}/chat/ensure-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, sellerId }),
    });
    if (r.ok) return r.json(); // { roomId }
  } catch (_) {}

  const [userRooms, sellerRooms] = await Promise.all([
    fetchUserRooms(apiBase, userId).catch(() => []),
    fetchSellerRooms(apiBase, sellerId).catch(() => []),
  ]);
  const setA = new Set((userRooms || []).map((x) => String(x.id || x._id || x.roomId)));
  const match = (sellerRooms || []).find((x) => setA.has(String(x.id || x._id || x.roomId)));
  if (match) return { roomId: String(match.id || match._id || match.roomId) };

  const create = await fetch(`${apiBase}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, sellerId }),
  });
  if (!create.ok) throw new Error("Unable to create/resolve room");
  return create.json(); // { roomId }
}
export function getAgoraToken(apiBase, channelName, uid) {
  const u = new URL(`${apiBase}/chat/agora/token`);
  u.searchParams.set("channelName", channelName);
  u.searchParams.set("uid", uid);
  return fetch(u.toString(), { cache: "no-store" }).then(json);
}
