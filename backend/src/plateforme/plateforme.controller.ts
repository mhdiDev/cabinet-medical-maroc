import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SuperAdminSeulement } from '../common/decorators/super-admin-seulement.decorator';
import { CreateCabinetDto, StatutCabinetDto, UpdateCabinetDto } from './dto/cabinet.dto';
import { PlateformeService } from './plateforme.service';

// :id n'est pas validé comme UUID : le premier cabinet a un identifiant fixe hors v4
@ApiTags('plateforme')
@ApiBearerAuth()
@SuperAdminSeulement()
@Controller('plateforme/cabinets')
export class PlateformeController {
  constructor(private service: PlateformeService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les cabinets (super admin)' })
  lister() {
    return this.service.lister();
  }

  @Post()
  @ApiOperation({ summary: 'Créer un cabinet et son titulaire (super admin)' })
  creer(@CurrentUser('id') superAdminId: string, @Body() dto: CreateCabinetDto) {
    return this.service.creer(superAdminId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Modifier les infos d'un cabinet (super admin)" })
  modifier(
    @CurrentUser('id') superAdminId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCabinetDto,
  ) {
    return this.service.modifier(superAdminId, id, dto);
  }

  @Patch(':id/statut')
  @ApiOperation({ summary: 'Suspendre ou réactiver un cabinet (super admin)' })
  changerStatut(
    @CurrentUser('id') superAdminId: string,
    @Param('id') id: string,
    @Body() dto: StatutCabinetDto,
  ) {
    return this.service.changerStatut(superAdminId, id, dto.actif);
  }

  @Post(':id/titulaire/reset-password')
  @ApiOperation({ summary: 'Réinitialiser le mot de passe du titulaire (super admin)' })
  reinitialiserTitulaire(@CurrentUser('id') superAdminId: string, @Param('id') id: string) {
    return this.service.reinitialiserTitulaire(superAdminId, id);
  }
}
