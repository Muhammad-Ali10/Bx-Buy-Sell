import { clientIp, clientUserAgent, requestOrigin, socketOrigin } from './request-origin';

/**
 * The client asked for sign-ins in the member's log; each one records where it
 * came from and on what browser.
 */
describe('request origin', () => {
  it('takes the address nginx passes on before its own', () => {
    expect(
      clientIp({ headers: { 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' }, ip: '10.0.0.2' }),
    ).toBe('203.0.113.7');
  });

  it('takes the first address of a forwarded chain', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '198.51.100.1, 10.0.0.2' }, ip: '10.0.0.2' })).toBe(
      '198.51.100.1',
    );
  });

  it("falls back to the connection's own address, written as plain IPv4", () => {
    expect(clientIp({ headers: {}, ip: '::ffff:192.0.2.10' })).toBe('192.0.2.10');
    expect(clientIp({ headers: {}, address: '192.0.2.11' })).toBe('192.0.2.11');
    expect(clientIp({ headers: {}, socket: { remoteAddress: '192.0.2.12' } })).toBe('192.0.2.12');
  });

  it('says so when there is nothing to go on', () => {
    expect(clientIp({})).toBeNull();
  });

  it('keeps the browser description, cut to a sensible length', () => {
    expect(clientUserAgent({ 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/128.0' })).toBe(
      'Mozilla/5.0 (Windows NT 10.0) Chrome/128.0',
    );
    expect(clientUserAgent({ 'user-agent': 'x'.repeat(500) })).toHaveLength(300);
    expect(clientUserAgent({})).toBeNull();
  });

  it('reads both from a web request and from a chat connection', () => {
    expect(requestOrigin({ headers: { 'user-agent': 'Chrome' }, ip: '192.0.2.1' })).toEqual({
      ipAddress: '192.0.2.1',
      userAgent: 'Chrome',
    });
    expect(
      socketOrigin({ handshake: { headers: { 'user-agent': 'Safari' }, address: '::ffff:192.0.2.2' } }),
    ).toEqual({ ipAddress: '192.0.2.2', userAgent: 'Safari' });
  });
});
