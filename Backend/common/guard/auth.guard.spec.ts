import { UnauthorizedException } from '@nestjs/common';

process.env.JWT_SECRET = 'test-secret';
// Read in the constructor, so it has to be set before the guard is imported
// and built.
import { AuthGuard } from './auth.guard';

/**
 * "Even though the user has the Buyer Premium subscription, they cannot open
 * these off-market listings."
 *
 * They could not because this guard returned from a public route before it
 * ever looked at the token, so the route that decides what a member may open
 * never learned that a member was asking.
 */
describe('AuthGuard on a public route', () => {
  const build = (isPublic: boolean, verify: jest.Mock) => {
    const request: Record<string, any> = { headers: {} };
    const context: any = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    };
    const guard = new AuthGuard(
      { verifyAsync: verify } as any,
      { getAllAndOverride: () => isPublic } as any,
    );
    return { guard, context, request };
  };

  const withToken = (request: Record<string, any>, token = 'a.b.c') => {
    request.headers.authorization = `Bearer ${token}`;
  };

  it('says who is asking, so a Premium member is recognised', async () => {
    const verify = jest.fn(async () => ({ id: 'buyer-1', role: 'USER' }));
    const { guard, context, request } = build(true, verify);
    withToken(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'buyer-1', role: 'USER' });
  });

  it('serves a visitor with no token as a guest', async () => {
    const verify = jest.fn();
    const { guard, context, request } = build(true, verify);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
    expect(verify).not.toHaveBeenCalled();
  });

  it('lets an expired token through as a guest rather than refusing it', async () => {
    const verify = jest.fn(async () => {
      throw new Error('jwt expired');
    });
    const { guard, context, request } = build(true, verify);
    withToken(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('still refuses an unsigned request on a route that is not public', async () => {
    const { guard, context } = build(false, jest.fn());

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
