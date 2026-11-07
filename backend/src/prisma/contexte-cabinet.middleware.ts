import { Injectable, NestMiddleware } from '@nestjs/common';
import { ouvrirContexte } from './contexte-cabinet';

@Injectable()
export class ContexteCabinetMiddleware implements NestMiddleware {
  use(_req: unknown, _res: unknown, next: () => void) {
    ouvrirContexte(next);
  }
}
