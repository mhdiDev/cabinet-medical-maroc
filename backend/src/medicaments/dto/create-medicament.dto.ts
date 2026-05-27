import { IsString, IsOptional, IsNumber, IsPositive, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMedicamentDto {
  @ApiProperty({ example: 'AMOXICILLINE SANDOZ 500 MG' })
  @IsString()
  @MaxLength(255)
  nom: string;

  @ApiProperty({ required: false, example: '6118001234567' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ required: false, example: 'AMOXICILLINE' })
  @IsOptional()
  @IsString()
  denomination?: string;

  @ApiProperty({ required: false, example: '500 MG' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiProperty({ required: false, example: 'GELULE' })
  @IsOptional()
  @IsString()
  forme?: string;

  @ApiProperty({ required: false, example: '1 BOITE 12 GELULES' })
  @IsOptional()
  @IsString()
  presentation?: string;

  @ApiProperty({ required: false, example: 45.5 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  ppv?: number;

  @ApiProperty({ required: false, example: 'G', description: 'P=Princeps, G=Générique' })
  @IsOptional()
  @IsString()
  princepsGenerique?: string;

  @ApiProperty({ required: false, example: '70%' })
  @IsOptional()
  @IsString()
  tauxRemboursement?: string;
}
