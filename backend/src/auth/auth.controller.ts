import { Controller, Post, Body, UseGuards, Req, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AutoriseSiMdpAChanger } from '../common/decorators/autorise-si-mdp-a-changer.decorator';
import { Role } from '@prisma/client';

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un utilisateur (admin)' })
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les utilisateurs (admin)' })
  listUsers() {
    return this.authService.listUsers();
  }

  @Post('users/:id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Réinitialiser le mot de passe d\'un utilisateur (admin)' })
  resetPassword(
    @CurrentUser('sub') adminId: string,
    @Param('id') userId: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(adminId, userId, dto.nouveauMdp);
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
