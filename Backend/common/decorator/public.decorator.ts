import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Puts one route back behind the guard inside an otherwise public controller.
 *
 * `AuthController` is marked `@Public()` on the class, which is right for
 * sign-up, sign-in and the password-reset flow — none of them can present a
 * token. Changing your own password is the opposite: it is only meaningful for
 * someone already signed in, and it reads who that is from `req.user`, which a
 * skipped guard never sets. The guard reads the handler before the class, so a
 * `false` here wins over the `true` above.
 */
export const Authenticated = () => SetMetadata(IS_PUBLIC_KEY, false);
