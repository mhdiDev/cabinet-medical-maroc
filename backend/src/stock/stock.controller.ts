import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { CreateStockArticleDto } from './dto/create-stock-article.dto';
import { CreateMouvementDto } from './dto/create-mouvement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private service: StockService) {}

  @Post('articles')
  @ApiOperation({ summary: 'Créer un article de stock' })
  createArticle(@Body() dto: CreateStockArticleDto) {
    return this.service.createArticle(dto);
  }

  @Get('articles')
  @ApiOperation({ summary: 'Lister les articles' })
  findAll() {
    return this.service.findAll();
  }

  @Get('articles/alertes')
  @ApiOperation({ summary: 'Articles sous seuil d\'alerte' })
  alertes() {
    return this.service.alertesManuelle();
  }

  @Get('articles/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('mouvements')
  @ApiOperation({ summary: 'Enregistrer une entrée/sortie de stock' })
  mouvement(@Body() dto: CreateMouvementDto, @CurrentUser('id') userId: string) {
    return this.service.mouvement(dto, userId);
  }
}
