import { SessionRecordReader } from '../../domain/usecases/adapter-interfaces/SessionRecordReader';
export declare class FileSystemSessionRecordReader implements SessionRecordReader {
    readCurrentSessionId: (configDir: string, pid: number) => string | null;
}
//# sourceMappingURL=FileSystemSessionRecordReader.d.ts.map