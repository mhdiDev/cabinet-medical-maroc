import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { NormaliserEmail } from '../../common/transforms/normaliser-email';

const Nettoye = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
// Écrit à la main : IsOptional laisserait passer null, refusé par la base (500)
const SiFourni = () => ValidateIf((_, v) => v !== undefined);

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @SiFourni()
  @Nettoye()
  @IsString()
  @IsNotEmpty()
  nom?: string;

  @ApiProperty({ required: false })
  @SiFourni()
  @Nettoye()
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
  @Nettoye()
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @Matches(/^0[5-7][0-9]{8}$/, { message: 'Téléphone marocain invalide' })
  telephone?: string | null;
}
