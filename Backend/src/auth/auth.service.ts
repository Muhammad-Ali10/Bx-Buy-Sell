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
      email,
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

    const isMatch = user
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    // Same message and status for unknown user and wrong password (no user enumeration).
    if (!user || !isMatch) {
      throw new HttpException(
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
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
  checkPassword(password: string, confirm_password: string) {
    if (password.toLowerCase().trim() !== confirm_password.toLowerCase().trim())
      return true;
    return false;
  }

  async sendEmail(email: string, otp: string) {
    const sendgrid = new MailService();

    console.log(process.env.SENDGRID_API_KEY);

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

  formatResponse(data: any) {
    delete data['password_hash'];
    if (data['refresh_token']) delete data['refresh_token'];
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
