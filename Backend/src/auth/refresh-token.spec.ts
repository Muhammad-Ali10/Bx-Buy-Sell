import { HttpException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

/**
 * PATCH /auth/refresh/:id is public. A wrong token used to clear the stored
 * one, so anyone who knew a user's id could sign them out at will. Only a
 * genuine refresh token of that account — an old one, used again — still
 * ends its sessions.
 */
describe('refreshing a session', () => {
  const USER = 'user-1';

  const build = async () => {
    const current = 'refresh-current';
    const user: any = { id: USER, blocked: false, refresh_token: await bcrypt.hash(current, 4) };
    const userService = {
      findOneByID: jest.fn(async () => user),
      updateUser: jest.fn(async (_id: string, data: any) => Object.assign(user, data)),
    };
    const jwt = {
      signAsync: jest.fn(async () => 'new-token'),
      // An old refresh token of this account verifies; anything else does not.
      verifyAsync: jest.fn(async (token: string) => {
        if (token === 'refresh-old') return { id: USER };
        if (token === 'refresh-of-someone-else') return { id: 'user-2' };
        throw new Error('invalid signature');
      }),
    };
    const service = new AuthService(userService as any, jwt as any, {} as any, {} as any);
    return { service, userService, user, current };
  };

  it('keeps the session when someone sends a made-up token', async () => {
    const { service, userService } = await build();
    await expect(service.updateRefreshToken(USER, 'not-a-token')).rejects.toBeInstanceOf(HttpException);
    expect(userService.updateUser).not.toHaveBeenCalled();
  });

  it("keeps the session when someone sends another account's token", async () => {
    const { service, userService } = await build();
    await expect(service.updateRefreshToken(USER, 'refresh-of-someone-else')).rejects.toBeInstanceOf(HttpException);
    expect(userService.updateUser).not.toHaveBeenCalled();
  });

  it("signs the account out when one of its own old tokens is used again", async () => {
    const { service, userService } = await build();
    await expect(service.updateRefreshToken(USER, 'refresh-old')).rejects.toBeInstanceOf(HttpException);
    expect(userService.updateUser).toHaveBeenCalledWith(USER, { refresh_token: null });
  });

  it('issues new tokens for the current one', async () => {
    const { service, userService, current } = await build();
    await expect(service.updateRefreshToken(USER, current)).resolves.toBeTruthy();
    expect(userService.updateUser).toHaveBeenCalledWith(USER, { refresh_token: expect.any(String) });
  });
});
