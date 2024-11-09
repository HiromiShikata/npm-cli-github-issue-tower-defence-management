// 0:50 , 1:10 = 0:20
// 23:50 , 0:00 = 0:10
// 0:20, 0:10 = 23:50
export const calcrateDuration = (
  start: string, // HH:mm
  end: string, // HH:mm
): string => {
  const [startHour, startMinute] = start.split(':').map((s) => parseInt(s, 10));
  const [endHour, endMinute] = end.split(':').map((s) => parseInt(s, 10));

  let durationHour = endHour - startHour;
  let durationMinute = endMinute - startMinute;

  if (durationMinute < 0) {
    durationHour -= 1;
    durationMinute += 60;
  }
  if (durationHour < 0) {
    durationHour += 24;
  }
  return `${String(durationHour).padStart(2, '0')}:${String(durationMinute).padStart(2, '0')}`;
};
export const totalDuration = (
  durations: string[], // HH:mm
): string => {
  const total = durations.reduce(
    (acc, cur) => {
      const [hour, minute] = cur.split(':').map((s) => parseInt(s, 10));
      return {
        hour: acc.hour + hour,
        minute: acc.minute + minute,
      };
    },
    { hour: 0, minute: 0 },
  );

  const totalHour = total.hour + Math.floor(total.minute / 60);
  const totalMinute = total.minute % 60;

  return `${String(totalHour).padStart(2, '0')}:${String(totalMinute).padStart(2, '0')}`;
};
