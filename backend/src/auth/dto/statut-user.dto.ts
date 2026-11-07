import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class StatutUserDto {
  // Valeur brute : la conversion implicite du ValidationPipe transformerait 'non' en true
  @ApiProperty() @Transform(({ obj }) => obj.actif) @IsBoolean() actif: boolean;
}
