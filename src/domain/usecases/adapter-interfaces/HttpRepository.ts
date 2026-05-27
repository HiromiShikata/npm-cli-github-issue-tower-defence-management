export interface HttpRepository {
  get: (url: string) => Promise<string>;
}
