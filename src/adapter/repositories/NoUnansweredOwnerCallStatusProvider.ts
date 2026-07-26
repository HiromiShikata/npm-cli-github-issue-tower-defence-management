import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';

export class NoUnansweredOwnerCallStatusProvider implements OwnerCallStatusProvider {
  listUnansweredOwnerCallEpochSecondsBySessionName = (
    _transcriptPathBySessionName: Map<string, string>,
  ): Promise<Map<string, number>> => {
    return Promise.resolve(new Map<string, number>());
  };
}
