import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaiementsService } from './paiements.service';
import { CreatePaiementDto } from './dto/create-paiement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('paiements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('paiements')
export class PaiementsController {
  constructor(private service: PaiementsService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer un paiement' })
  create(@Body() dto: CreatePaiementDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get('caisse')
  @ApiOperation({ summary: 'Caisse journalière' })
  caisse(@Query('date') date?: string) {
    return this.service.caisse(date);
  }

  @Get('rapport')
  @ApiOperation({ summary: 'Rapport de recettes par période' })
  rapport(@Query('debut') debut: string, @Query('fin') fin: string) {
    return this.service.rapport(debut, fin);
  }
}
