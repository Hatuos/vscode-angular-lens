/**
 * Returns a Date object set to the end of that day in UTC (23:59:59.999)
 * 
 * If the format is invalid or the date does not exist, it returns undefined.
 * 
 * @param value A date string in the format: "2024-06" / "2024-06-15"
 * @returns A Date object set to the end of that day in UTC (23:59:59.999) / undefined
 */
export function parseSupportEndDate(value: string): Date | undefined {
	const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
	if (!match) { return undefined; }

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = match[3] ? Number(match[3]) : new Date(Date.UTC(year, month, 0)).getUTCDate();
	const supportEndDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
	if (supportEndDate.getUTCFullYear() !== year || supportEndDate.getUTCMonth() !== month - 1 || supportEndDate.getUTCDate() !== day) {
		return undefined;
	}
	return supportEndDate;
}

/**
 * Adds a given number of calendar months to a Date.
 *
 * Keeps the month-based logic consistent with normal calendar rules.
 * If the original day does not exist in the target month, it automatically clamps to the last valid day of that month.
 * 
 * @param date Date to be updated
 * @param months Months to add to the date
 * @returns Updated date
 */
export function addCalendarMonths(date: Date, months: number): Date {
	const result = new Date(date);
	const day = result.getUTCDate();
	result.setUTCDate(1);
	result.setUTCMonth(result.getUTCMonth() + months);
	const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
	result.setUTCDate(Math.min(day, lastDay));
	return result;
}