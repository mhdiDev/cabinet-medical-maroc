import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Res, HttpStatus, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { SearchPatientDto } from './dto/search-patient.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un patient' })
  @ApiResponse({ status: 201, description: 'Patient créé avec succès' })
  create(@Body() dto: CreatePatientDto, @CurrentUser('id') userId: string) {
    return this.patientsService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Lister/rechercher les patients' })
  findAll(@Query() dto: SearchPatientDto) {
    return this.patientsService.findAll(dto);
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.MEDECIN)
  @ApiOperation({ summary: 'Statistiques patients' })
  getStats() {
    return this.patientsService.getStats();
  }

  @Get('export/csv')
  @Roles(Role.ADMIN, Role.MEDECIN)
  @ApiOperation({ summary: 'Export CSV des patients' })
  async exportCsv(@Res() res: Response) {
    const csv = await this.patientsService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="patients.csv"');
    res.send('\uFEFF' + csv); // BOM pour Excel
  }

  @Get('cin/:cin')
  @ApiOperation({ summary: 'Rechercher un patient par CIN' })
  findByCin(@Param('cin') cin: string) {
    return this.patientsService.findByCin(cin);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fiche patient complète' })
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un patient' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.patientsService.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.MEDECIN)
  @ApiOperation({ summary: 'Supprimer (désactiver) un patient' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.patientsService.remove(id, userId);
  }
}
