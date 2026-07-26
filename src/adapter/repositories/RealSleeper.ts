import { Sleeper } from '../../domain/usecases/adapter-interfaces/Sleeper';

export class RealSleeper implements Sleeper {
  sleep = (milliseconds: number): Promise<void> => {
    if (milliseconds <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  };
}
