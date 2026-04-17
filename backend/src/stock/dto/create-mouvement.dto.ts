import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TypeMouvement } from '@prisma/client';

export class CreateMouvementDto {
  @ApiProperty() @IsString() articleId: string;

  @ApiProperty({ enum: TypeMouvement })
  @IsEnum(TypeMouvement)
  type: TypeMouvement;

  @ApiProperty() @IsNumber() @Min(1) quantite: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() motif?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() consultationId?: string;
}
