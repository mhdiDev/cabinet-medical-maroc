import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AUTORISE_SI_MDP_A_CHANGER_KEY } from '../decorators/autorise-si-mdp-a-changer.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = (await super.canActivate(context)) as boolean;
    if (!authenticated) return false;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.doitChangerMdp) return true;

    const autorise = this.reflector.getAllAndOverride<boolean>(AUTORISE_SI_MDP_A_CHANGER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (autorise) return true;

    throw new ForbiddenException({
      code: 'MUST_CHANGE_PASSWORD',
      message: 'Vous devez changer votre mot de passe',
    });
  }
}
