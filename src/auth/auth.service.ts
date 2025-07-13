import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async validateGoogleUser(googleProfile: any) {
    const { id, displayName, emails, photos } = googleProfile;
    const email = emails && emails[0] ? emails[0].value : null;

    try {
      let user = await this.prisma.user.findUnique({
        where: { googleId: id },
      });

      if (!user && email) {
        user = await this.prisma.user.findUnique({
          where: { email },
        });

        if (user) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: id,
              avatar: photos && photos[0] ? photos[0].value : null,
              name: user.name || displayName,
            },
          });
        }
      }

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            googleId: id,
            email,
            name: displayName,
            avatar: photos && photos[0] ? photos[0].value : null,
          },
        });
      }

      this.logger.log(`✅ Usuario autenticado: ${user.email || user.name}`);
      return user;
    } catch (error) {
      this.logger.error('Error en validación de Google:', error);
      throw error;
    }
  }

  async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    };
  }

  async validateJwtUser(payload: any) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          createdAt: true,
        },
      });

      if (!user) {
        return null;
      }

      return user;
    } catch (error) {
      this.logger.error('Error en validación JWT:', error);
      return null;
    }
  }

  async verifyGoogleToken(credential: string) {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      return ticket;
    } catch (error) {
      this.logger.error('Error verificando token de Google:', error);
      throw new Error('Token de Google inválido');
    }
  }
}
