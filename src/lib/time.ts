// Slots are timestamptz. Shop and customer views both render in ONE display timezone so the
// buyer's chips line up with what the shop published (Barberly is a Taiwan marketplace, TWD).
export const DISPLAY_TZ = "Asia/Taipei";
export const DISPLAY_TZ_LABEL = "Taipei time";
const DISPLAY_TZ_OFFSET = "+08:00"; // Taiwan has no DST

/** YYYY-MM-DD of an instant, in the display timezone. */
export const dayKey = (iso: string | number | Date) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: DISPLAY_TZ });

export const todayKey = () => dayKey(Date.now());

/** "14:30" in the display timezone. */
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: DISPLAY_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });

/** "Sat, Nov 21" for a YYYY-MM-DD day key. */
export const fmtDay = (key: string) =>
  new Date(`${key}T12:00:00${DISPLAY_TZ_OFFSET}`).toLocaleDateString("en-US", {
    timeZone: DISPLAY_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

/** A local date + time typed by the shop, interpreted in the display timezone. */
export const displayTzDate = (date: string, time: string) =>
  new Date(`${date}T${time}${time.length === 5 ? ":00" : ""}${DISPLAY_TZ_OFFSET}`);
