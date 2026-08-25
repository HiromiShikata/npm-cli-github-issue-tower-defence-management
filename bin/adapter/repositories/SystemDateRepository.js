"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemDateRepository = void 0;
class SystemDateRepository {
    constructor() {
        this.now = async () => new Date();
        this.formatDurationToHHMM = (durationMinutes) => {
            const hours = Math.floor(durationMinutes / 60);
            const minutes = Math.floor(durationMinutes % 60);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        };
        this.formatDateTimeWithDayOfWeek = (date) => {
            const dateWithDayOfWeek = this.formatDateWithDayOfWeek(date);
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            return `${dateWithDayOfWeek} ${hours}:${minutes}`;
        };
        this.formatDateWithDayOfWeek = (date) => {
            const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            return `${date.getUTCFullYear()}/${month}/${day} (${dayOfWeek})`;
        };
        this.formatStartEnd = (start, end) => {
            const endDate = start.getUTCFullYear() === end.getUTCFullYear() &&
                start.getUTCMonth() === end.getUTCMonth() &&
                start.getUTCDate() === end.getUTCDate()
                ? `${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`
                : this.formatDateTimeWithDayOfWeek(end);
            return `${this.formatDateTimeWithDayOfWeek(start)} - ${endDate}`;
        };
    }
}
exports.SystemDateRepository = SystemDateRepository;
//# sourceMappingURL=SystemDateRepository.js.map