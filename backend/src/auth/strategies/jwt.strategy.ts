import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaSansFiltre } from '../../prisma/prisma.service';
import { MESSAGE_CABINET_SUSPENDU, cabinetSuspendu } from '../cabinet-suspendu';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaSansFiltre) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        actif: true,
        doitChangerMdp: true,
        cabinetId: true,
        estTitulaire: true,
        cabinet: { select: { actif: true } },
      },
    });

    if (!user || !user.actif) {
      throw new UnauthorizedException('Compte désactivé ou inexistant');
    }

    if (cabinetSuspendu(user.cabinet)) {
      throw new UnauthorizedException(MESSAGE_CABINET_SUSPENDU);
    }

    const { cabinet: _cabinet, ...profil } = user;
    return { ...profil, sub: user.id };
  }
}
