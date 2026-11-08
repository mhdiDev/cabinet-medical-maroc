import { IsEmail, IsString, IsNotEmpty, IsIn, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { NormaliserEmail } from '../../common/transforms/normaliser-email';
import { NettoyerTexte } from '../../common/transforms/nettoyer-texte';

// Le mot de passe initial est généré par le serveur : il n'est pas fourni par l'admin
export class CreateUserDto {
  @ApiProperty()
  @NormaliserEmail()
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @ApiProperty()
  @NettoyerTexte()
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty()
  @NettoyerTexte()
  @IsString()
  @IsNotEmpty()
  prenom: string;

  @ApiProperty({ enum: [Role.MEDECIN, Role.SECRETAIRE] })
  @IsIn([Role.MEDECIN, Role.SECRETAIRE], { message: 'Rôle invalide' })
  role: Role;

  @ApiProperty({ required: false, example: '0612345678' })
  @NettoyerTexte()
  @IsOptional()
  @Matches(/^0[5-7][0-9]{8}$/, { message: 'Téléphone marocain invalide' })
  telephone?: string;
}
