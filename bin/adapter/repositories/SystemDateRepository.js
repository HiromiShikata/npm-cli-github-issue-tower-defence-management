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
            const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${date.getFullYear()}/${month}/${day} (${dayOfWeek}) ${hours}:${minutes}`;
        };
    }
}
exports.SystemDateRepository = SystemDateRepository;
//# sourceMappingURL=SystemDateRepository.js.map