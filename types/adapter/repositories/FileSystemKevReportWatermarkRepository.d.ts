import { KevReportWatermark } from '../../domain/entities/KevReportWatermark';
import { KevReportWatermarkLoadResult, KevReportWatermarkRepository } from '../../domain/usecases/adapter-interfaces/KevReportWatermarkRepository';
export declare class FileSystemKevReportWatermarkRepository implements KevReportWatermarkRepository {
    private readonly stateFilePath;
    constructor(stateFilePath?: string);
    load: () => Promise<KevReportWatermarkLoadResult>;
    save: (watermark: KevReportWatermark) => Promise<void>;
    private unreadable;
}
//# sourceMappingURL=FileSystemKevReportWatermarkRepository.d.ts.map