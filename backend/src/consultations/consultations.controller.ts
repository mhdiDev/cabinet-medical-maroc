import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ConsultationsService } from './consultations.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('consultations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('consultations')
export class ConsultationsController {
  constructor(private service: ConsultationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister toutes les consultations' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'date', required: false })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('q') q?: string,
    @Query('date') date?: string,
  ) {
    return this.service.findAll(page ? +page : 1, limit ? +limit : 20, q, date);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MEDECIN)
  @ApiOperation({ summary: 'Créer une consultation (ADMIN, MEDECIN uniquement)' })
  create(@Body() dto: CreateConsultationDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string) {
    return this.service.findByPatient(patientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MEDECIN)
  @ApiOperation({ summary: 'Modifier une consultation (ADMIN, MEDECIN uniquement)' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateConsultationDto>, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }
}
