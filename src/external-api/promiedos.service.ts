import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import {} from './interfaces/game.interface';

@Injectable()
export class PromiedosService {
  private readonly baseUrl = 'https://api.promiedos.com.ar';

  async getMatchday(roundId: number) {
    if (roundId) {
      const { data } = await axios.get(
        `${this.baseUrl}/league/games/hc/72_224_8_${roundId}`,
      );
      return data.games;
    }
  }
}
