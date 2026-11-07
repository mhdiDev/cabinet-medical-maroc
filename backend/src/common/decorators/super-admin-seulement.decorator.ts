import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SuperAdminGuard } from '../guards/super-admin.guard';

// Route réservée à l'administrateur de la plateforme
export const SuperAdminSeulement = () => UseGuards(JwtAuthGuard, SuperAdminGuard);
