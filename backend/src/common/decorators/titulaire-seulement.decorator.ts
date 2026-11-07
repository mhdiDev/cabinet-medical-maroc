import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TitulaireGuard } from '../guards/titulaire.guard';

// Route réservée au médecin titulaire du cabinet
export const TitulaireSeulement = () => UseGuards(JwtAuthGuard, TitulaireGuard);
