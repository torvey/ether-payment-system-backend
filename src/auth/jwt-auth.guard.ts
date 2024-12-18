import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Sprawdź, czy endpoint ma dekorator @Public()
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );
    if (isPublic) {
      return true; // Jeśli endpoint jest publiczny, przepuść żądanie
    }

    // Wywołaj domyślne działanie guardu JWT
    const canActivate = (await super.canActivate(context)) as boolean;

    if (!canActivate) {
      return false;
    }

    const request = context.switchToHttp().getRequest();

    const user = request.user;

    if (!user || !user.userId) {
      return false;
    }

    request.user = user;

    return true;
  }
}
