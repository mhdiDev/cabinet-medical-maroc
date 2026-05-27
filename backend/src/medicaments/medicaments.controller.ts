import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MedicamentsService } from './medicaments.service';
import { CreateMedicamentDto } from './dto/create-medicament.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('medicaments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('medicaments')
export class MedicamentsController {
  constructor(private service: MedicamentsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Rechercher un médicament (autocomplete ordonnance)' })
  @ApiQuery({ name: 'q', description: 'Nom ou DCI du médicament' })
  @ApiQuery({ name: 'limit', required: false, description: 'Nb résultats max (défaut 15)' })
  search(@Query('q') q: string, @Query('limit') limit?: number) {
    return this.service.search(q, limit ? +limit : 15);
  }

  @Post('find-or-create')
  @ApiOperation({
    summary: 'Retourner un médicament existant ou le créer',
    description:
      'Utilisé par le formulaire d\'ordonnance : si le médicament tapé existe en base il est retourné, sinon il est créé.',
  })
  findOrCreate(@Body() dto: CreateMedicamentDto) {
    return this.service.findOrCreate(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un médicament' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un médicament manuellement' })
  create(@Body() dto: CreateMedicamentDto) {
    return this.service.create(dto);
  }
}
