type HeaderBag = Record<string, unknown>;

const firstValue = (value: unknown): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.split(',')[0].trim() : '';
};

/**
 * Where a request came from, for the activity log.
 *
 * Behind nginx the socket address belongs to the proxy, so the address the
 * proxy passes on comes first: `x-real-ip`, then the first entry of
 * `x-forwarded-for`. A client talking to the server directly can put anything
 * in those headers, so this is a record of what was reported, not proof.
 */
export function clientIp(source: {
  headers?: HeaderBag | null;
  ip?: string | null;
  /** socket.io puts the peer address on the handshake. */
  address?: string | null;
  socket?: { remoteAddress?: string | null } | null;
}): string | null {
  const headers = source.headers ?? {};
  const candidate =
    firstValue(headers['x-real-ip']) ||
    firstValue(headers['x-forwarded-for']) ||
    source.ip ||
    source.address ||
    source.socket?.remoteAddress ||
    '';
  // Node writes an IPv4 peer as an IPv6-mapped address.
  const cleaned = candidate.replace(/^::ffff:/, '');
  return cleaned || null;
}

/** The browser's own description of itself, kept short. */
export function clientUserAgent(headers?: HeaderBag | null): string | null {
  const raw = headers?.['user-agent'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 300) : null;
}

export interface RequestOrigin {
  ipAddress: string | null;
  userAgent: string | null;
}

/** Where an HTTP request came from. */
export const requestOrigin = (req: any): RequestOrigin => ({
  ipAddress: clientIp({ headers: req?.headers, ip: req?.ip, socket: req?.socket }),
  userAgent: clientUserAgent(req?.headers),
});

/** Where a chat connection came from. */
export const socketOrigin = (client: any): RequestOrigin => ({
  ipAddress: clientIp({
    headers: client?.handshake?.headers,
    address: client?.handshake?.address,
  }),
  userAgent: clientUserAgent(client?.handshake?.headers),
});
