import { Controller, Get, Post, Body, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { OrdonnancesService } from './ordonnances.service';
import { CreateOrdonnanceDto } from './dto/create-ordonnance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('ordonnances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ordonnances')
export class OrdonnancesController {
  constructor(private service: OrdonnancesService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une ordonnance' })
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
