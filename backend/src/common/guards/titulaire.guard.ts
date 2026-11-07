import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class TitulaireGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user?.estTitulaire) {
      throw new ForbiddenException('Accès réservé au médecin titulaire');
    }
    return true;
  }
}
