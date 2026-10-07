export function parseSupportEndDate(value: string): Date | undefined {
	const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
	if (!match) {
		return undefined;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = match[3] ? Number(match[3]) : new Date(Date.UTC(year, month, 0)).getUTCDate();
	const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
		return undefined;
	}
	return date;
}

export function addCalendarMonths(date: Date, months: number): Date {
	const result = new Date(date);
	const day = result.getUTCDate();
	result.setUTCDate(1);
	result.setUTCMonth(result.getUTCMonth() + months);
	const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
	result.setUTCDate(Math.min(day, lastDay));
	return result;
}