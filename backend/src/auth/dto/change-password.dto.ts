import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty() @IsString() ancienMdp: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  nouveauMdp: string;
}
