import ky from 'ky';
import { HttpRepository } from '../../domain/usecases/adapter-interfaces/HttpRepository';

export class KyHttpRepository implements HttpRepository {
  get = async (url: string): Promise<string> => {
    return ky.get(url).text();
  };
}
