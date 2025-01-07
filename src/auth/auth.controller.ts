import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { AuthorizationTokenService } from './authorization-token.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private userService: UserService,
    private twoFactorService: TwoFactorService,
    private authService: AuthService,
    private authorizationTokenService: AuthorizationTokenService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() { email, password }: { email: string; password: string },
  ) {
    const user = await this.userService.findUserByEmail(email);

    if (user) {
      throw new BadRequestException('User with this email already exists');
    }

    if (!this.authService.isPasswordStrong(password)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long, include uppercase, lowercase, a number, and a special character.',
      );
    }

    await this.userService.createUser(email, password);

    return { message: 'User registered successfully' };
  }

  @Public()
  @Post('login')
  async login(
    @Body() { email, password }: { email: string; password: string },
  ) {
    const user = await this.userService.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error('Invalid credentials');
    }

    // Wygeneruj nowy token tymczasowy
    const authorizationToken = await this.authorizationTokenService.createToken(
      user.id,
    );

    await this.twoFactorService.generateCode(user.id, user.email);

    return { message: 'Login successful', authorizationToken };
  }

  @Public()
  @Post('verify-2fa')
  async verify2fa(
    @Body()
    { authorizationToken, code }: { authorizationToken: string; code: string },
  ) {
    const userId =
      await this.authorizationTokenService.getTokenUser(authorizationToken);

    const user = await this.userService.findUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await this.twoFactorService.validateCode(userId, code);

    if (!isValid) {
      throw new Error('Invalid or expired code');
    }

    // Wygeneruj token JWT
    const token = await this.authService.generateJwt(user);

    return { message: 'Login successful', token };
  }

  @Public()
  @Post('validate-auth-token')
  async validateAuthToken(
    @Body() { authorizationToken }: { authorizationToken: string },
  ) {
    return this.authorizationTokenService.validateToken(authorizationToken);
  }

  @Get('is-logged')
  isLogged(@Req() request) {
    const { user } = request;

    return {
      message: 'User is authenticated',
      user: {
        id: user.userId,
        email: user.email,
      },
    };
  }
}
