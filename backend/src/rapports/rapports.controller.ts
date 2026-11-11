import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RapportsService } from './rapports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('rapports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rapports')
export class RapportsController {
  constructor(private service: RapportsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Données tableau de bord',
    description:
      'Un médecin voit ses propres RDV (jour, semaine, graphique) ; la secrétaire voit ceux de tout le cabinet.',
  })
  dashboard(@CurrentUser() user: { id: string; role: Role }) {
    return this.service.dashboard(user);
  }
}
