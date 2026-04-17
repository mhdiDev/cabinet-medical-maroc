import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStockArticleDto {
  @ApiProperty() @IsString() nom: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() reference?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;

  @ApiProperty({ default: 0 }) @IsOptional() @IsNumber() @Min(0) quantite?: number;
  @ApiProperty({ default: 5 }) @IsOptional() @IsNumber() @Min(0) seuilAlerte?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsString() fournisseur?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) prixUnitaire?: number;
  @ApiProperty({ default: 'unité' }) @IsOptional() @IsString() unite?: string;
}
