import { IsString, IsDateString, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StatutRDV } from '@prisma/client';

export class CreateRendezVousDto {
  @ApiProperty() @IsString() patientId: string;
  @ApiProperty() @IsString() medecinId: string;
  @ApiProperty() @IsDateString() dateHeure: string;

  @ApiProperty({ default: 30 })
  @IsOptional() @IsInt() @Min(5) @Max(240)
  dureeMinutes?: number = 30;

  @ApiProperty({ required: false }) @IsOptional() @IsString() motif?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}
