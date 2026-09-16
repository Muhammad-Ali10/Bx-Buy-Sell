import { RolesGuard } from './role.guard';

/**
 * A public route can now be called by someone signed in, which is what lets
 * the off-market cards tell a Premium member from a guest. The role that
 * comes with them still has to be the one in the database, not the one their
 * token was minted with.
 */
describe('RolesGuard on a public route', () => {
  const build = (user: any, account: any) => {
    const request: Record<string, any> = { user };
    const findRoleByID = jest.fn(async () => account);
    const context: any = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    };
    const guard = new RolesGuard(
      { getAllAndOverride: () => true } as any,
      { findRoleByID } as any,
    );
    return { guard, context, request, findRoleByID };
  };

  it('uses the role the database holds, not the one in the token', async () => {
    const { guard, context, request } = build(
      { id: 'demoted-1', role: 'ADMIN' },
      { id: 'demoted-1', role: 'USER', blocked: false },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user.role).toBe('USER');
  });

  it('serves a blocked account as a guest instead of refusing it', async () => {
    const { guard, context, request } = build(
      { id: 'blocked-1', role: 'USER' },
      { id: 'blocked-1', role: 'USER', blocked: true },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('asks nothing of the database for a visitor who is not signed in', async () => {
    const { guard, context, findRoleByID } = build(undefined, null);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findRoleByID).not.toHaveBeenCalled();
  });
});
