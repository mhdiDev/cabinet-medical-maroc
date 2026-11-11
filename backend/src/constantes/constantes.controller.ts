import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type Auteur, ConstantesService } from './constantes.service';
import { CreateConstantesDto } from './dto/create-constantes.dto';
import { UpdateConstantesDto } from './dto/update-constantes.dto';

@ApiTags('constantes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('constantes')
export class ConstantesController {
  constructor(private service: ConstantesService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer une prise de constantes (médecin ou secrétaire)' })
  create(@Body() dto: CreateConstantesDto, @CurrentUser() user: Auteur) {
    return this.service.create(dto, user);
  }

  @Get('patient/:patientId/du-jour')
  @ApiOperation({ summary: 'Prise du jour non rattachée à une consultation' })
  duJour(@Param('patientId') patientId: string) {
    return this.service.duJour(patientId);
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string) {
    return this.service.findByPatient(patientId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateConstantesDto, @CurrentUser() user: Auteur) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: Auteur) {
    return this.service.remove(id, user);
  }
}
