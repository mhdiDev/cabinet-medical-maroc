import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TypeMouvement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateStockArticleDto } from './dto/create-stock-article.dto';
import { CreateMouvementDto } from './dto/create-mouvement.dto';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async createArticle(dto: CreateStockArticleDto) {
    return this.prisma.stockArticle.create({ data: dto });
  }

  async findAll() {
    const articles = await this.prisma.stockArticle.findMany({
      where: { actif: true },
      orderBy: { nom: 'asc' },
    });

    // Ajout indicateur alerte
    return articles.map((a) => ({
      ...a,
      alerteStock: a.quantite <= a.seuilAlerte,
    }));
  }

  async findOne(id: string) {
    const article = await this.prisma.stockArticle.findUnique({
      where: { id },
      include: {
        mouvements: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!article) throw new NotFoundException(`Article ${id} introuvable`);
    return { ...article, alerteStock: article.quantite <= article.seuilAlerte };
  }

  async mouvement(dto: CreateMouvementDto, userId: string) {
    const article = await this.prisma.stockArticle.findUnique({ where: { id: dto.articleId } });
    if (!article) throw new NotFoundException('Article introuvable');

    // Vérification stock suffisant pour sortie
    if (dto.type === TypeMouvement.SORTIE && article.quantite < dto.quantite) {
      throw new BadRequestException(
        `Stock insuffisant: ${article.quantite} disponible, ${dto.quantite} demandé`,
      );
    }

    const delta = dto.type === TypeMouvement.ENTREE ? dto.quantite : -dto.quantite;

    const [mouvement] = await this.prisma.$transaction([
      this.prisma.stockMouvement.create({
        data: { ...dto, createdById: userId },
      }),
      this.prisma.stockArticle.update({
        where: { id: dto.articleId },
        data: { quantite: { increment: delta } },
      }),
    ]);

    await this.audit.log(userId, `STOCK_${dto.type}`, 'StockArticle', dto.articleId, {
      quantite: dto.quantite,
    });

    return mouvement;
  }

  async alertesManuelle() {
    const articles = await this.prisma.stockArticle.findMany({ where: { actif: true } });
    return articles.filter((a) => a.quantite <= a.seuilAlerte);
  }
}
