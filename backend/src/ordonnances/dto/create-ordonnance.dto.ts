import { IsString, IsOptional, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class MedicamentOrdonnanceDto {
  @IsOptional() @IsString() medicamentId?: string;
  @IsOptional() @IsString() nomLibre?: string;
  @ApiProperty() @IsString() posologie: string;
  @IsOptional() @IsString() duree?: string;
  @IsOptional() @IsInt() @Min(1) quantite?: number;
}

export class CreateOrdonnanceDto {
  @ApiProperty() @IsString() patientId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() consultationId?: string;
  @ApiProperty() @IsString() medecinNom: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() medecinSpec?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() medecinRPPM?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;

  @ApiProperty({ type: [MedicamentOrdonnanceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicamentOrdonnanceDto)
  medicaments: MedicamentOrdonnanceDto[];
}
