import { Controller, Get, Post, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { OrdonnancesService } from './ordonnances.service';
import { CreateOrdonnanceDto } from './dto/create-ordonnance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('ordonnances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ordonnances')
export class OrdonnancesController {
  constructor(private service: OrdonnancesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister toutes les ordonnances' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('q') q?: string,
  ) {
    return this.service.findAll(page ? +page : 1, limit ? +limit : 20, q);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MEDECIN)
  @ApiOperation({ summary: 'Créer une ordonnance (ADMIN, MEDECIN uniquement)' })
  create(@Body() dto: CreateOrdonnanceDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Ordonnances d\'un patient' })
  findByPatient(@Param('patientId') patientId: string) {
    return this.service.findByPatient(patientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Télécharger ordonnance en PDF' })
  async generatePdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.service.generatePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ordonnance-${id}.pdf"`);
    res.send(buffer);
  }
}
