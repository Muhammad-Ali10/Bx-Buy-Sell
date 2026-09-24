import { GroupCallError, GroupCallRegistry, groupCallCredentials } from './group-call';

describe('group calls', () => {
  const start = (registry = new GroupCallRegistry()) => ({
    registry,
    call: registry.start('chat-1', 'admin-1', ['buyer-1', 'seller-1'], { now: 1_000, hostSocketId: 's-admin' }),
  });

  it('invites the buyer and the seller, never the host', () => {
    const { call } = start();
    expect(call.invited).toEqual(['buyer-1', 'seller-1']);
    expect(call.channel).toMatch(/^gc_[0-9a-f]{32}$/);
  });

  it('runs one call per conversation at a time', () => {
    const { registry } = start();
    expect(() => registry.start('chat-1', 'admin-2', ['buyer-1'])).toThrow(GroupCallError);
  });

  it('lets in only those invited, and only while the call runs', () => {
    const { registry, call } = start();
    expect(() => registry.join('chat-1', call.callId, 'stranger')).toThrow('not invited');
    expect(() => registry.join('chat-1', 'old-call', 'buyer-1')).toThrow('already ended');
    registry.join('chat-1', call.callId, 'buyer-1');
    expect([...call.present]).toEqual(['buyer-1']);
  });

  it('goes on with whoever joined, and names who never came', () => {
    const { registry, call } = start();
    registry.join('chat-1', call.callId, 'buyer-1');
    registry.leave('chat-1', call.callId, 'buyer-1');
    expect(registry.decline('chat-1', call.callId, 'buyer-1')).toBe(false); // already came in
    expect(registry.decline('chat-1', call.callId, 'seller-1')).toBe(true);
    const ended = registry.end('chat-1', call.callId, 91_000);
    expect(ended?.summary).toEqual({ durationSeconds: 90, participants: 2, missed: ['seller-1'] });
    expect(registry.get('chat-1')).toBeUndefined();
  });

  it('finds the calls a socket was hosting', () => {
    const { registry } = start();
    expect(registry.hostedBySocket('s-admin')).toHaveLength(1);
    expect(registry.hostedBySocket('s-other')).toHaveLength(0);
  });

  it('refuses a call with nobody to invite', () => {
    expect(() => new GroupCallRegistry().start('chat-2', 'admin-1', ['admin-1'])).toThrow(GroupCallError);
  });

  it('mints a token only when Agora is configured', () => {
    expect(groupCallCredentials('gc_x', 'buyer-1', { appId: '', certificate: '' })).toBeNull();
    const creds = groupCallCredentials('gc_x', 'buyer-1', {
      appId: '0123456789abcdef0123456789abcdef',
      certificate: 'fedcba9876543210fedcba9876543210',
    });
    expect(creds?.uid).toBe('buyer-1');
    expect(creds?.token.length).toBeGreaterThan(50);
  });
});
