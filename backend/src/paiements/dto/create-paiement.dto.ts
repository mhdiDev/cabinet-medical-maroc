import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TypePaiement } from '@prisma/client';

export class CreatePaiementDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() rendezVousId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() patientId?: string;

  @ApiProperty({ example: 200 })
  @IsNumber() @Min(0)
  montant: number;

  @ApiProperty({ default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  montantRemise?: number = 0;

  @ApiProperty({ enum: TypePaiement, default: TypePaiement.ESPECE })
  @IsEnum(TypePaiement)
  typePaiement: TypePaiement;

  @ApiProperty({ required: false }) @IsOptional() @IsString() referenceAssurance?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
}
