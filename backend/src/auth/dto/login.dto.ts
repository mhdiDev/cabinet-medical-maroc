import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'dr.benali@cabinet.ma' })
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @ApiProperty({ example: 'Medecin123!' })
  @IsString()
  @MinLength(6, { message: 'Mot de passe trop court' })
  motDePasse: string;
}
