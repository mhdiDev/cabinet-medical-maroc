import { Controller, Post, Body, UseGuards, Req, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AutoriseSiMdpAChanger } from '../common/decorators/autorise-si-mdp-a-changer.decorator';
import { TitulaireSeulement } from '../common/decorators/titulaire-seulement.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Connexion utilisateur' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rafraîchir le token JWT' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @AutoriseSiMdpAChanger()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnexion' })
  logout(@CurrentUser('sub') userId: string) {
    return this.authService.logout(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AutoriseSiMdpAChanger()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil utilisateur connecté' })
  me(@CurrentUser() user: any) {
    return user;
  }

  @Post('users')
  @TitulaireSeulement()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un utilisateur (titulaire)' })
  createUser(@CurrentUser('sub') adminId: string, @Body() dto: CreateUserDto) {
    return this.authService.createUser(adminId, dto);
  }

  @Get('users')
  @TitulaireSeulement()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les utilisateurs (titulaire)' })
  listUsers() {
    return this.authService.listUsers();
  }

  @Post('users/:id/reset-password')
  @TitulaireSeulement()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Réinitialiser le mot de passe d'un utilisateur (titulaire)" })
  resetPassword(
    @CurrentUser('sub') adminId: string,
    @Param('id') userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() _dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(adminId, userId);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @AutoriseSiMdpAChanger()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Changer le mot de passe' })
  changePassword(@CurrentUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto.ancienMdp, dto.nouveauMdp);
  }
}
