import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SignUpSchemaType } from 'src/auth/dto/signup-user.dto';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { signInSchema, SignInSchemaType } from './dto/signin.dto';
import { randomBytes } from 'crypto';
import { VerifyOtpType } from './dto/verify.dto';
import sendgrid, { MailDataRequired, MailService } from '@sendgrid/mail';
@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  // SignUp Service
  async signUp(body: SignUpSchemaType): Promise<unknown> {
    const { password, confirm_password, email } = body;

    // Check Password If They are Matched
    if (this.checkPassword(password, confirm_password))
      throw new HttpException(`Password do not matched`, HttpStatus.FORBIDDEN);

    // Check if User Exist
    if (await this.isUserExist(email))
      throw new HttpException(`User Already Exists`, HttpStatus.CONFLICT);

    const hash = await this.hashData(password);

    const payload = {
      role: process.env.DEFAULT_ROLE || 'USER',
      email: UserService.normalizeEmail(email),
      password_hash: hash,
      first_name: body.first_name,
      last_name: body.last_name,
      verified: true, // Set verified to true by default for new signups
    };

    const user = await this.userService.createUser(payload);

    let formattedUser = this.formatResponse(user);
    const { accessToken, refreshToken } = await this.getTokens(user);

    const hashedToken = await this.hashData(refreshToken);

    const loggedInUser = await this.userService.updateUser(user.id, {
      refresh_token: hashedToken,
    });
    formattedUser = this.formatResponse(loggedInUser);

    return {
      user: formattedUser,
      tokens: { accessToken, refreshToken: refreshToken },
    };
  }

  // SignIn Service
  async signIn(body: SignInSchemaType): Promise<unknown> {
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

    return {
      user: formattedUser,
      tokens: { accessToken, refreshToken: refreshToken },
    };
  }

  // Get OTP Service
  async getOTP(email: string) {
    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      throw new HttpException('User Not Found', HttpStatus.NOT_FOUND);
    }
    const otp = this.generateSecureOTP();

    // await this.sendEmail(email, otp);
    await this.userService.updateUser(user.id, { otp_code: otp });
    return { message: 'OTP Sent successfully', success: true };
  }

  // Verify OTP Service
  async verifyOTP(body: VerifyOtpType) {
    const { otp_code, email } = body;
    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      throw new HttpException('User Not Found', HttpStatus.NOT_FOUND);
    }
    if (user.otp_code !== otp_code) {
      throw new HttpException('Invalid OTP', HttpStatus.BAD_REQUEST);
    }
    await this.userService.updateUser(user.id, {
      otp_code: '',
      is_email_verified: true,
    });
    return { message: 'OTP verified successfully', success: true };
  }

  // Logout Service
  async logout(userId: string) {
    const user = await this.userService.findOneByID(userId);
    if (!user) throw new HttpException('User Not Found', HttpStatus.NOT_FOUND);
    await this.userService.updateUser(userId, {
      refresh_token: null,
      is_online: false,
      last_offline: new Date(),
    });
    return true;
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

  async sendEmail(email: string, otp: string) {
    const sendgrid = new MailService();

    sendgrid.setApiKey(process.env.SENDGRID_API_KEY!);

    const msg = {
      to: email, // Change to your recipient
      from: process.env.EMAIL_SERVICE_FROM, // Change to your verified sender
      subject: 'Your verification code',
      text: `Your code is ${otp}. Do not share it with anyone.`,
      html: `<h2>Your code is <h1>${otp}</h1>. Do not share it with anyone.</h2>`,
    } as MailDataRequired;

    try {
      const response = await sendgrid.send(msg);
      console.log('Email sent', response);
    } catch (error) {
      console.log(error.response.body.errors);
    }
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

  // Reset Password - Send OTP
  async resetPassword(email: string) {
    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      throw new HttpException('User Not Found', HttpStatus.NOT_FOUND);
    }
    const otp = this.generateSecureOTP();
    await this.userService.updateUser(user.id, { otp_code: otp });
    // TODO: Send email with OTP and reset link
    // await this.sendEmail(email, otp);
    return { message: 'Password reset OTP sent to your email', success: true };
  }

  // Update Password with OTP
  async updatePassword(email: string, otp_code: string, new_password: string, confirm_password: string) {
    // Check passwords match
    if (this.checkPassword(new_password, confirm_password)) {
      throw new HttpException('Passwords do not match', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      throw new HttpException('User Not Found', HttpStatus.NOT_FOUND);
    }

    // Verify OTP
    if (user.otp_code !== otp_code) {
      throw new HttpException('Invalid OTP', HttpStatus.BAD_REQUEST);
    }

    // Hash new password
    const hash = await this.hashData(new_password);
    
    // Update password and clear OTP
    await this.userService.updateUser(user.id, {
      password_hash: hash,
      otp_code: '',
    });

    return { message: 'Password updated successfully', success: true };
  }
}
