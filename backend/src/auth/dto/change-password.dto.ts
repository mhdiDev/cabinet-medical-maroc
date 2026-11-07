import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const REGLE_MDP =
  'Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule et un chiffre';

export class ChangePasswordDto {
  @ApiProperty() @IsString() ancienMdp: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: REGLE_MDP })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: REGLE_MDP })
  nouveauMdp: string;
}
