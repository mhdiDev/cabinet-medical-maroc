import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConsultationDto {
  @ApiProperty() @IsString() patientId: string;
  @ApiProperty() @IsString() medecinId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() rendezVousId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() dateConsultation?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() motif?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() anamnese?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() examenClinique?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() diagnostic?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() traitement?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() actes?: string[];
}
