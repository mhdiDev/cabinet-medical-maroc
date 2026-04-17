import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RapportsService } from './rapports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('rapports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rapports')
export class RapportsController {
  constructor(private service: RapportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Données tableau de bord' })
  dashboard() {
    return this.service.dashboard();
  }
}
