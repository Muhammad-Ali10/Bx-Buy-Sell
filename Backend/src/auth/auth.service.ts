import { HttpException, HttpStatus, Injectable, Optional } from '@nestjs/common';
import { SignUpSchemaType } from 'src/auth/dto/signup-user.dto';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { signInSchema, SignInSchemaType } from './dto/signin.dto';
import { randomBytes } from 'crypto';
import { VerifyOtpType } from './dto/verify.dto';
import { InboxCodeService } from 'src/user/inbox-code.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import type { RequestOrigin } from 'src/activity-log/request-origin';
@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private readonly inboxCode: InboxCodeService,
    /** Sign-ins, sign-outs and password changes go into the member's log. */
    @Optional() private readonly activityLog?: ActivityLogService,
  ) {}

  // SignUp Service
  async signUp(body: SignUpSchemaType, origin?: RequestOrigin): Promise<unknown> {
    const { password, confirm_password, email } = body;

    // Check Password If They are Matched
    if (this.checkPassword(password, confirm_password))
      throw new HttpException(`Password do not matched`, HttpStatus.FORBIDDEN);

    // Check if User Exist
    if (await this.isUserExist(email))
      throw new HttpException(`User Already Exists`, HttpStatus.CONFLICT);

    const hash = await this.hashData(password);

    /*
     * `verified` is left at the schema's default of false.
     *
     * It used to be set true here for every new account, which made the flag
     * mean "has an account" rather than "has proved who they are" — and the
     * listing page drew an "ID Verified" badge from it. Thirty-six of the
     * forty-eight members carry it today without a single identity check
     * having been run against any of them.
     *
     * The one place that may set it is the identity service, when the provider
     * comes back approved.
     */
    const payload = {
      role: process.env.DEFAULT_ROLE || 'USER',
      email: UserService.normalizeEmail(email),
      password_hash: hash,
      first_name: body.first_name,
      last_name: body.last_name,
    };

    const user = await this.userService.createUser(payload);

    let formattedUser = this.formatResponse(user);
    const { accessToken, refreshToken } = await this.getTokens(user);

    const hashedToken = await this.hashData(refreshToken);

    const loggedInUser = await this.userService.updateUser(user.id, {
      refresh_token: hashedToken,
    });
    formattedUser = this.formatResponse(loggedInUser);

    void this.activityLog?.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'profile.account-created',
      entityType: 'user',
      entityId: user.id,
      message: 'Signed up',
      ...origin,
    });

    return {
      user: formattedUser,
      tokens: { accessToken, refreshToken: refreshToken },
    };
  }

  // SignIn Service
  async signIn(body: SignInSchemaType, origin?: RequestOrigin): Promise<unknown> {
    const { email, password } = body;
    const user = await this.userService.findOneByEmail(email);

    // Accounts registered through the public signup pages had their password
    // lowercased in the browser before it ever reached here, so their stored
    // hash is of the folded text. Those pages now send what the person typed,
    // which would lock every one of those accounts out — so a failed match is
    // tried once more against the folded form, and a hit is re-hashed on the
    // spot. Each of those accounts repairs itself the next time its owner
    // signs in, and new ones are never folded at all.
    let isMatch = user
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (user && !isMatch) {
      const folded = password.toLowerCase().trim();
      if (folded !== password && (await bcrypt.compare(folded, user.password_hash))) {
        isMatch = true;
        await this.userService
          .updateUser(user.id, { password_hash: await this.hashData(password) })
          .catch(() => {
            // Signing in matters more than the migration; it will be retried
            // on the next successful sign-in.
          });
      }
    }

    // Same message and status for unknown user and wrong password (no user enumeration).
    if (!user || !isMatch) {
      throw new HttpException(
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // A closed account must stay closed. Without this the "delete my account"
    // button would only hide the row — the same password would still sign
    // straight back in.
    if ((user as any).deleted_at) {
      throw new HttpException(
        'This account has been closed. Please contact support if this is a mistake.',
        HttpStatus.FORBIDDEN,
      );
    }

    // Correct credentials are not enough: a blocked account must not get in.
    // Said plainly, because the person needs to know who to contact.
    if ((user as any).blocked) {
      throw new HttpException(
        'This account has been blocked. Please contact support.',
        HttpStatus.FORBIDDEN,
      );
    }

    // Removing Unnecessary Data & Getting Tokens
    let formattedUser = this.formatResponse(user);
    const { accessToken, refreshToken } = await this.getTokens(user);

    // Updating Refresh Token
    const hashedToken = await this.hashData(refreshToken);
    const loggedInUser = await this.userService.updateUser(user.id, {
      refresh_token: hashedToken,
    });

    // Formatting Response
    formattedUser = this.formatResponse(loggedInUser);

    // The client asked to see sign-ins in the member's log, with where from.
    void this.activityLog?.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'auth.sign-in',
      entityType: 'user',
      entityId: user.id,
      message: 'Signed in',
      ...origin,
    });

    return {
      user: formattedUser,
      tokens: { accessToken, refreshToken: refreshToken },
    };
  }

  /**
   * Email a confirmation code, by address — the older, public form of
   * `POST /user/me/email/confirm/send-code`.
   *
   * It stored a four-digit code and emailed nothing. The same answer comes back
   * whether or not the address has an account, so this cannot be used to find
   * out who is registered.
   */
  async getOTP(email: string) {
    const user = await this.userService.findOneByEmail(email);
    if (user && !user.is_email_verified) {
      await this.inboxCode.send(user, 'verify');
    }
    return { message: 'If this address has an account, a code is on its way.', success: true };
  }

  /** Confirm an address with its emailed code; the public form of `me/email/confirm`. */
  async verifyOTP(body: VerifyOtpType) {
    const { otp_code, email } = body;
    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      throw new HttpException('That code is not right.', HttpStatus.BAD_REQUEST);
    }
    await this.inboxCode.check(user, otp_code, true);
    await this.userService.updateUser(user.id, { is_email_verified: true });
    void this.activityLog?.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'profile.email-verified',
      entityType: 'user',
      entityId: user.id,
      message: 'Email address confirmed',
    });
    return { message: 'Email confirmed', success: true };
  }

  // Logout Service
  async logout(userId: string, origin?: RequestOrigin, accessToken?: string) {
    const user = await this.userService.findOneByID(userId);
    if (!user) throw new HttpException('User Not Found', HttpStatus.NOT_FOUND);
    await this.userService.updateUser(userId, {
      refresh_token: null,
      is_online: false,
      last_offline: new Date(),
    });

    // The route is public and names its account in the address, so a sign-out
    // goes into the log only when the caller's own token is for that account.
    if (accessToken && (await this.tokenOwner(accessToken)) === userId) {
      void this.activityLog?.record({
        actorId: userId,
        actorRole: (user as any).role,
        action: 'auth.sign-out',
        entityType: 'user',
        entityId: userId,
        message: 'Signed out',
        ...origin,
      });
    }
    return true;
  }

  /** The account an access token belongs to, or null when it does not check out. */
  private async tokenOwner(token: string): Promise<string | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
      return typeof payload?.id === 'string' ? payload.id : null;
    } catch {
      return null;
    }
  }

  // Refresh Token Service
  async updateRefreshToken(userId: string, refreshToken: string) {
    const user = await this.userService.findOneByID(userId);

    // Blocking clears the stored refresh token, but check anyway so a token
    // captured beforehand cannot be traded for a fresh session.
    if ((user as any)?.blocked) {
      throw new HttpException(
        'This account has been blocked. Please contact support.',
        HttpStatus.FORBIDDEN,
      );
    }

    const isValid = await bcrypt.compare(
      refreshToken,
      user?.refresh_token as string,
    );

    if (!isValid) {
      await this.userService.updateUser(userId, { refresh_token: null });
      throw new HttpException(`Invalid Refresh Token`, HttpStatus.FORBIDDEN);
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.getTokens(user);
    const hashed = await this.hashData(newRefreshToken);
    const newUser = await this.userService.updateUser(userId, {
      refresh_token: hashed,
    });
    const formattedUser = this.formatResponse(newUser);
    return {
      user: formattedUser,
      tokens: { accessToken, refreshToken: newRefreshToken },
    };
  }

  // Helper Functions
  /** True when the two do not match. Compared exactly: "Pass" and "pass" are
   *  different passwords, and treating them as equal let someone confirm a
   *  password they had not actually typed twice. */
  checkPassword(password: string, confirm_password: string) {
    if (password !== confirm_password) return true;
    return false;
  }

  generateSecureOTP(length = 4) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      const randomByte = randomBytes(1)[0];

      otp += digits[randomByte % 10]; // Secure digit
    }
    return otp;
  }

  async isUserExist(email: string) {
    const user = await this.userService.findOneByEmail(email);
    if (user) return true;
    return false;
  }

  async hashData(password: string) {
    const saltOrRounds = 10;
    return await bcrypt.hash(password, saltOrRounds);
  }

  /**
   * What the browser is allowed to see of a user row.
   *
   * Deleting only the password and refresh token left every verification code
   * in the payload — and those end up in localStorage. A code mailed to a new
   * address is only a proof of ownership while it stays in that inbox.
   */
  formatResponse(data: any) {
    if (!data || typeof data !== 'object') return data;
    for (const secret of [
      'password_hash',
      'refresh_token',
      'otp_code',
      'phone_otp',
      'email_otp',
    ]) {
      delete data[secret];
    }
    return data;
  }

  async addToken(payload: any) {
    payload['accessToken'] = await this.jwtService.signAsync(payload);
    const response = this.formatResponse(payload);
    return response;
  }

  async getTokens(payload: any) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '7h',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    ]);
    return { accessToken, refreshToken };
  }

  /**
   * Start a password reset: email a code to the address.
   *
   * The code used to be stored and never sent, so nobody could finish a reset.
   * The answer is the same whether or not the address has an account.
   */
  async resetPassword(email: string) {
    const user = await this.userService.findOneByEmail(email);
    if (user && !(user as any).blocked) {
      await this.inboxCode.send(user, 'reset');
    }
    return { message: 'If this address has an account, a code is on its way.', success: true };
  }

  /**
   * Check a reset code without spending it. The reset screens take the code
   * first and the new password after; the team's screens used to "verify" it
   * with the address-confirmation call, which cleared it, so the password step
   * that followed always failed.
   */
  async checkResetCode(email: string, otp_code: string) {
    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      throw new HttpException('That code is not right.', HttpStatus.BAD_REQUEST);
    }
    await this.inboxCode.check(user, otp_code, false);
    return { success: true };
  }

  /**
   * A signed-in member changes their own password.
   *
   * Separate from the OTP flow above, which exists for people who cannot sign
   * in and which cannot finish today anyway: it mails a code, and the mailer
   * has no verified sender configured. Someone already signed in does not need
   * to be told a code they could read in their own inbox — knowing the current
   * password proves the same thing, immediately.
   *
   * The mismatch and the wrong-current-password cases answer differently. That
   * is deliberate: both are the account holder's own mistake, and telling them
   * which one they made reveals nothing they did not already know.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
    origin?: RequestOrigin,
  ) {
    if (this.checkPassword(newPassword, confirmPassword)) {
      throw new HttpException('Passwords do not match', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userService.findCredentialsByID(userId);
    if (!user) {
      throw new HttpException('User Not Found', HttpStatus.NOT_FOUND);
    }
    if (!user.password_hash) {
      throw new HttpException(
        'This account has no password set. Use the reset link instead.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      throw new HttpException(
        'Your current password is not correct',
        HttpStatus.BAD_REQUEST,
      );
    }

    // A new password that is the old one is a no-op the member would read as
    // success, so say so rather than pretending something changed.
    if (await bcrypt.compare(newPassword, user.password_hash)) {
      throw new HttpException(
        'That is already your current password',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.userService.updateUser(user.id, {
      password_hash: await this.hashData(newPassword),
    });

    void this.activityLog?.record({
      actorId: user.id,
      action: 'auth.password-changed',
      entityType: 'user',
      entityId: user.id,
      message: 'Changed their password',
      ...origin,
    });

    return { message: 'Password changed', success: true };
  }

  // Update Password with OTP
  /**
   * Finish a password reset. The code is spent here, and every other session
   * ends: a reset is often what someone does after losing control of an account.
   */
  async updatePassword(
    email: string,
    otp_code: string,
    new_password: string,
    confirm_password: string,
    origin?: RequestOrigin,
  ) {
    if (this.checkPassword(new_password, confirm_password)) {
      throw new HttpException('Passwords do not match', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      throw new HttpException('That code is not right.', HttpStatus.BAD_REQUEST);
    }

    await this.inboxCode.check(user, otp_code, true);

    const hash = await this.hashData(new_password);
    await this.userService.updateUser(user.id, {
      password_hash: hash,
      refresh_token: null,
    });

    void this.activityLog?.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'auth.password-reset',
      entityType: 'user',
      entityId: user.id,
      message: 'Reset their password with an emailed code',
      ...origin,
    });

    return { message: 'Password updated successfully', success: true };
  }
}
