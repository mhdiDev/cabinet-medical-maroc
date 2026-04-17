import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RendezVousService } from './rendez-vous.service';
import { CreateRendezVousDto } from './dto/create-rendez-vous.dto';
import { UpdateRendezVousDto } from './dto/update-rendez-vous.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StatutRDV } from '@prisma/client';

@ApiTags('rendez-vous')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rendez-vous')
export class RendezVousController {
  constructor(private service: RendezVousService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un rendez-vous' })
  create(@Body() dto: CreateRendezVousDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get('agenda')
  @ApiOperation({ summary: 'Agenda par médecin et période' })
  agenda(
    @Query('medecinId') medecinId: string,
    @Query('debut') debut: string,
    @Query('fin') fin: string,
  ) {
    return this.service.findByMedecin(medecinId, debut, fin);
  }

  @Get('today')
  @ApiOperation({ summary: 'RDV du jour' })
  today(@Query('medecinId') medecinId: string) {
    return this.service.findToday(medecinId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRendezVousDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/statut')
  @ApiOperation({ summary: 'Changer le statut du RDV' })
  updateStatut(
    @Param('id') id: string,
    @Body('statut') statut: StatutRDV,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.updateStatut(id, statut, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Annuler un rendez-vous' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.remove(id, userId);
  }
}
