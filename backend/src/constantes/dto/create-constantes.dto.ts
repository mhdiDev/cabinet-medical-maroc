import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { CHAMPS, type ChampMesure } from '../seuils';

const fr = (n: number) => String(n).replace('.', ',');
// Message français commun aux contrôles d'un champ (type, minimum, maximum)
const hors = (c: ChampMesure) => ({
  message: `${CHAMPS[c].libelle} : entre ${fr(CHAMPS[c].min)} et ${fr(CHAMPS[c].max)} ${CHAMPS[c].unite}`,
});
const DECIMALES = { maxDecimalPlaces: 2 };

export class CreateConstantesDto {
  @ApiProperty() @IsString() patientId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() consultationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() datePrise?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt(hors('tensionSystolique'))
  @Min(CHAMPS.tensionSystolique.min, hors('tensionSystolique'))
  @Max(CHAMPS.tensionSystolique.max, hors('tensionSystolique'))
  tensionSystolique?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt(hors('tensionDiastolique'))
  @Min(CHAMPS.tensionDiastolique.min, hors('tensionDiastolique'))
  @Max(CHAMPS.tensionDiastolique.max, hors('tensionDiastolique'))
  tensionDiastolique?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt(hors('pouls'))
  @Min(CHAMPS.pouls.min, hors('pouls'))
  @Max(CHAMPS.pouls.max, hors('pouls'))
  pouls?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt(hors('spo2'))
  @Min(CHAMPS.spo2.min, hors('spo2'))
  @Max(CHAMPS.spo2.max, hors('spo2'))
  spo2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber(DECIMALES, hors('temperature'))
  @Min(CHAMPS.temperature.min, hors('temperature'))
  @Max(CHAMPS.temperature.max, hors('temperature'))
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber(DECIMALES, hors('poids'))
  @Min(CHAMPS.poids.min, hors('poids'))
  @Max(CHAMPS.poids.max, hors('poids'))
  poids?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber(DECIMALES, hors('taille'))
  @Min(CHAMPS.taille.min, hors('taille'))
  @Max(CHAMPS.taille.max, hors('taille'))
  taille?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber(DECIMALES, hors('glycemie'))
  @Min(CHAMPS.glycemie.min, hors('glycemie'))
  @Max(CHAMPS.glycemie.max, hors('glycemie'))
  glycemie?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber(DECIMALES, hors('perimetreCranien'))
  @Min(CHAMPS.perimetreCranien.min, hors('perimetreCranien'))
  @Max(CHAMPS.perimetreCranien.max, hors('perimetreCranien'))
  perimetreCranien?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber(DECIMALES, hors('tourDeTaille'))
  @Min(CHAMPS.tourDeTaille.min, hors('tourDeTaille'))
  @Max(CHAMPS.tourDeTaille.max, hors('tourDeTaille'))
  tourDeTaille?: number;
}
