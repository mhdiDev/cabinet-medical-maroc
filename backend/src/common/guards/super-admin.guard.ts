import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    // Défense en profondeur : un SUPER_ADMIN n'est rattaché à aucun cabinet
    if (user?.role !== 'SUPER_ADMIN' || user.cabinetId != null) {
      throw new ForbiddenException("Accès réservé à l'administrateur de la plateforme");
    }
    return true;
  }
}
