import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

const contexte = (user: unknown) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('laisse passer un SUPER_ADMIN', () => {
    expect(guard.canActivate(contexte({ role: 'SUPER_ADMIN' }))).toBe(true);
  });

  it.each([
    { role: 'MEDECIN' },
    { role: 'MEDECIN', estTitulaire: true },
    { role: 'SECRETAIRE' },
    undefined,
  ])('refuse %j', (user) => {
    expect(() => guard.canActivate(contexte(user))).toThrow(ForbiddenException);
  });
});
