import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';

export class NoUnansweredOwnerCallStatusProvider
  implements OwnerCallStatusProvider
{
  listSessionNamesWithUnansweredOwnerCall = (
    _sessionNames: string[],
  ): Promise<Set<string>> => {
    return Promise.resolve(new Set<string>());
  };
}
