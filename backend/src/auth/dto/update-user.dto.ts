import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { NormaliserEmail } from '../../common/transforms/normaliser-email';
import { NettoyerTexte } from '../../common/transforms/nettoyer-texte';

// Écrit à la main : IsOptional laisserait passer null, refusé par la base (500)
const SiFourni = () => ValidateIf((_, v) => v !== undefined);

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @SiFourni()
  @NettoyerTexte()
  @IsString()
  @IsNotEmpty()
  nom?: string;

  @ApiProperty({ required: false })
  @SiFourni()
  @NettoyerTexte()
  @IsString()
  @IsNotEmpty()
  prenom?: string;

  @ApiProperty({ required: false })
  @SiFourni()
  @NormaliserEmail()
  @IsEmail({}, { message: 'Email invalide' })
  email?: string;

  // null ou '' efface le numéro
  @ApiProperty({ required: false, nullable: true, example: '0612345678' })
  @NettoyerTexte()
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @Matches(/^0[5-7][0-9]{8}$/, { message: 'Téléphone marocain invalide' })
  telephone?: string | null;
}
