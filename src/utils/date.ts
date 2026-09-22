/**
 * Formats ISO date string into Arabic format like:
 * "17 سبتمبر 2026 - 07:30 ص"
 */
export function formatArabicDateTime(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return 'غير محدد';

  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return String(dateInput);

    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const day = date.getDate();
    const month = arabicMonths[date.getMonth()];
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';

    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const hoursStr = hours.toString().padStart(2, '0');

    return `${day} ${month} ${year} - ${hoursStr}:${minutes} ${ampm}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats ISO date string into Arabic format with seconds like:
 * "17 سبتمبر 2026 - 07:30:45 م"
 */
export function formatArabicDateTimeWithSeconds(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return 'غير محدد';

  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return String(dateInput);

    const arabicDays = [
      'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'
    ];

    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const dayName = arabicDays[date.getDay()];
    const day = date.getDate();
    const month = arabicMonths[date.getMonth()];
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';

    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = hours.toString().padStart(2, '0');

    return `${dayName}، ${day} ${month} ${year} - ${hoursStr}:${minutes}:${seconds} ${ampm}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats date only (e.g. 17 سبتمبر 2026)
 */
export function formatArabicDateOnly(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return 'غير محدد';

  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return String(dateInput);

    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const day = date.getDate();
    const month = arabicMonths[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats time only with seconds (e.g. 07:30:45 م)
 */
export function formatArabicTimeOnly(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';

  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '';

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';

    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = hours.toString().padStart(2, '0');

    return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
  } catch {
    return '';
  }
}

/**
 * Returns date in YYYY-MM-DD format based on device's local timezone.
 */
export function getLocalISODate(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Returns date in YYYY-MM-DD format based on Saudi Arabia (Asia/Riyadh, GMT+3) timezone.
 */
export function getRiyadhISODate(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '';

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Riyadh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(date);
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      if (year && month && day) {
        return `${year}-${month}-${day}`;
      }
    } catch {}

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date).trim();
  } catch {
    return getLocalISODate(dateInput);
  }
}

/**
 * Returns today's YYYY-MM-DD in Saudi Arabia timezone
 */
export function getTodayISODate(): string {
  return getRiyadhISODate(new Date()) || getLocalISODate(new Date());
}

/**
 * Returns yesterday's YYYY-MM-DD in Saudi Arabia timezone
 */
export function getYesterdayISODate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getRiyadhISODate(yesterday) || getLocalISODate(yesterday);
}

/**
 * Accurately checks whether a date timestamp belongs to the given filter date string (YYYY-MM-DD).
 * Evaluates across Saudi Riyadh timezone, local browser timezone, and raw ISO timestamp.
 */
export function isMatchingFilterDate(dateInput: string | Date | undefined | null, filterDate: string): boolean {
  if (!filterDate) return true;
  if (!dateInput) return false;

  const targetDate = filterDate.trim();
  if (!targetDate) return true;

  const riyadhToday = getRiyadhISODate(new Date());
  const localToday = getLocalISODate(new Date());

  // If the user is filtering for "today" (either via today's date in Riyadh or locally)
  if (targetDate === riyadhToday || targetDate === localToday) {
    const rDate = getRiyadhISODate(dateInput);
    const lDate = getLocalISODate(dateInput);
    if (rDate === riyadhToday || rDate === localToday || lDate === riyadhToday || lDate === localToday) {
      return true;
    }
  }

  const riyadhDate = getRiyadhISODate(dateInput);
  if (riyadhDate === targetDate) return true;

  const localDate = getLocalISODate(dateInput);
  if (localDate === targetDate) return true;

  if (typeof dateInput === 'string' && dateInput.trim().startsWith(targetDate)) {
    return true;
  }

  return false;
}


