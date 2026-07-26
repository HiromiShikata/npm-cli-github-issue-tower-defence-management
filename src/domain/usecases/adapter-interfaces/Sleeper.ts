export interface Sleeper {
  sleep: (milliseconds: number) => Promise<void>;
}
