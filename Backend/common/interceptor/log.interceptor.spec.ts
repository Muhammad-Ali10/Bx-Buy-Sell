import { lastValueFrom, of } from 'rxjs';
import { LogInterceptor } from './log.interceptor';

const contextFor = (req: Record<string, unknown>) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  }) as any;

const build = (logAction: { action: string; entity: string } | undefined) => {
  const activityLog = { record: jest.fn().mockResolvedValue(undefined) };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(logAction) };
  return { activityLog, interceptor: new LogInterceptor(activityLog as any, reflector as any) };
};

/**
 * The team's endpoints used to write the submitted form into the log, with
 * the password an admin typed in it.
 */
describe('LogInterceptor', () => {
  it('writes what happened, to whom, and from where, but never the form', async () => {
    const { activityLog, interceptor } = build({ action: 'update-by-admin', entity: 'user' });
    const req = {
      user: { id: 'admin-1', role: 'ADMIN' },
      params: { id: 'member-1' },
      url: '/user/update-by-admin/member-1',
      body: { first_name: 'Jane', password: 'hunter2' },
      headers: { 'x-real-ip': '203.0.113.7', 'user-agent': 'Mozilla/5.0 Chrome/128.0' },
    };

    await lastValueFrom(interceptor.intercept(contextFor(req), { handle: () => of({ ok: true }) }));

    expect(activityLog.record).toHaveBeenCalledWith({
      actorId: 'admin-1',
      actorRole: 'ADMIN',
      subjectUserId: 'member-1',
      action: 'team.account-edited',
      entityType: 'user',
      entityId: 'member-1',
      message: 'Account details changed',
      ipAddress: '203.0.113.7',
      userAgent: 'Mozilla/5.0 Chrome/128.0',
    });
    expect(JSON.stringify(activityLog.record.mock.calls)).not.toContain('hunter2');
  });

  it('names the account an admin has just created', async () => {
    const { activityLog, interceptor } = build({ action: 'create-by-admin', entity: 'user' });
    const req = { user: { id: 'admin-1', role: 'ADMIN' }, params: {}, url: '/user/create-by-admin', headers: {} };

    await lastValueFrom(interceptor.intercept(contextFor(req), { handle: () => of({ id: 'new-1' }) }));

    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ subjectUserId: 'new-1', entityId: 'new-1', message: 'Account created' }),
    );
  });

  it('keeps a prohibited word about no one in particular', async () => {
    const { activityLog, interceptor } = build({ action: 'create-prohibited-word', entity: 'prohibited-word' });
    const req = { user: { id: 'admin-1', role: 'ADMIN' }, params: {}, url: '/prohibited-word', headers: {} };

    await lastValueFrom(interceptor.intercept(contextFor(req), { handle: () => of({ id: 'word-1' }) }));

    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ subjectUserId: null, action: 'team.prohibited-word-added' }),
    );
  });

  it('writes nothing for an endpoint that is not logged, or with nobody signed in', async () => {
    const unlogged = build(undefined);
    await lastValueFrom(unlogged.interceptor.intercept(contextFor({}), { handle: () => of(1) }));
    expect(unlogged.activityLog.record).not.toHaveBeenCalled();

    const anonymous = build({ action: 'block', entity: 'user' });
    await lastValueFrom(
      anonymous.interceptor.intercept(contextFor({ params: { id: 'm' }, url: '/user', headers: {} }), {
        handle: () => of(1),
      }),
    );
    expect(anonymous.activityLog.record).not.toHaveBeenCalled();
  });
});
