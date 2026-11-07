import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { NormaliserEmail } from '../../common/transforms/normaliser-email';

const Nettoye = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const TELEPHONE = /^0[5-7][0-9]{8}$/;
const MESSAGE_TELEPHONE = 'Téléphone marocain invalide';

export class InfosCabinetDto {
  @ApiProperty() @Nettoye() @IsString() @IsNotEmpty() nom: string;
  @ApiProperty() @Nettoye() @IsString() @IsNotEmpty() adresse: string;
  @ApiProperty() @Nettoye() @IsString() @IsNotEmpty() ville: string;
  @ApiProperty({ example: '0522123456' })
  @Matches(TELEPHONE, { message: MESSAGE_TELEPHONE })
  telephone: string;
}

export class TitulaireDto {
  @ApiProperty() @NormaliserEmail() @IsEmail({}, { message: 'Email invalide' }) email: string;
  @ApiProperty() @Nettoye() @IsString() @IsNotEmpty() prenom: string;
  @ApiProperty() @Nettoye() @IsString() @IsNotEmpty() nom: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(TELEPHONE, { message: MESSAGE_TELEPHONE })
  telephone?: string;
}

export class CreateCabinetDto extends InfosCabinetDto {
  @ApiProperty({ type: TitulaireDto })
  @IsDefined()
  @IsObject() // un tableau passerait ValidateNested sans rien valider
  @ValidateNested()
  @Type(() => TitulaireDto)
  titulaire: TitulaireDto;
}

// Écrit à la main : IsOptional (PartialType) laisserait passer null, refusé par la base (500).
// Seul un champ absent est ignoré ; les règles sont celles de la création.
const SiFourni = () => ValidateIf((_, v) => v !== undefined);

export class UpdateCabinetDto {
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
  adresse?: string;

  @ApiProperty({ required: false })
  @SiFourni()
  @Nettoye()
  @IsString()
  @IsNotEmpty()
  ville?: string;

  @ApiProperty({ required: false, example: '0522123456' })
  @SiFourni()
  @Matches(TELEPHONE, { message: MESSAGE_TELEPHONE })
  telephone?: string;
}

export class StatutCabinetDto {
  // Valeur brute : la conversion implicite du ValidationPipe transformerait 'non' en true
  @ApiProperty() @Transform(({ obj }) => obj.actif) @IsBoolean() actif: boolean;
}
