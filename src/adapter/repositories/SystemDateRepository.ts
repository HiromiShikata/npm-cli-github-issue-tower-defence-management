import { DateRepository } from '../../domain/usecases/adapter-interfaces/DateRepository';

export class SystemDateRepository implements DateRepository {
  now = async () => new Date();
}
