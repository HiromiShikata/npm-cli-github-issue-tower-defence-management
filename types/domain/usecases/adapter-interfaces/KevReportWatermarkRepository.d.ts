import { KevReportWatermark } from '../../entities/KevReportWatermark';
export type KevReportWatermarkLoadResult = {
    type: 'absent';
} | {
    type: 'stored';
    watermark: KevReportWatermark;
} | {
    type: 'unreadable';
    reason: string;
};
export interface KevReportWatermarkRepository {
    load: () => Promise<KevReportWatermarkLoadResult>;
    save: (watermark: KevReportWatermark) => Promise<void>;
}
//# sourceMappingURL=KevReportWatermarkRepository.d.ts.map