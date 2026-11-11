import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
  IsISO8601,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NettoyerTexte } from '../../common/transforms/nettoyer-texte';

export class SearchPatientDto {
  @ApiProperty({
    required: false,
    description: 'Nom, prénom ou téléphone (plusieurs mots possibles)',
  })
  @IsOptional()
  @NettoyerTexte()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiProperty({
    required: false,
    example: '2026-11-10',
    description: 'Patients vus en consultation ce jour-là (heure de Casablanca)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide' })
  @IsISO8601({ strict: true }, { message: 'Date invalide' })
  date?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
