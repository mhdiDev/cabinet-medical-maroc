import {
  IsString, IsEmail, IsOptional, IsEnum, IsDateString,
  IsArray, Matches, MaxLength, IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Sexe } from '@prisma/client';

export class CreatePatientDto {
  @ApiProperty({ example: 'Tazi' })
  @IsString()
  @MaxLength(100)
  nom: string;

  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  @MaxLength(100)
  prenom: string;

  @ApiProperty({ example: '1985-03-15' })
  @IsDateString()
  dateNaissance: string;

  @ApiProperty({ enum: Sexe })
  @IsEnum(Sexe)
  sexe: Sexe;

  @ApiProperty({ example: '0671234567' })
  @IsString()
  @Matches(/^(0[5-7][0-9]{8}|05[0-9]{8})$/, {
    message: 'Numéro de téléphone marocain invalide',
  })
  telephone: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adresse?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ville?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  codePostal?: string;

  @ApiProperty({ required: false, example: 'A+' })
  @IsOptional()
  @IsString()
  groupeSanguin?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  antecedents?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  numeroAssurance?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  estAssure?: boolean;
}
