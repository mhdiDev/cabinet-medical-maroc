import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormaliserEmail } from '../../common/transforms/normaliser-email';

export class LoginDto {
  @ApiProperty({ example: 'dr.benali@cabinet.ma' })
  @NormaliserEmail()
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @ApiProperty({ example: 'Medecin123!' })
  @IsString()
  @MinLength(6, { message: 'Mot de passe trop court' })
  motDePasse: string;
}
