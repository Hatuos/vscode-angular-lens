export interface RequestPerformance {
	calls: number;
	totalDurationMs: number;
	lastDurationMs: number;
}

export class RequestPerformanceService {
	private readonly requestPerformance = new Map<string, RequestPerformance>();

	async measureRequest<T>(name: string, request: () => Promise<T>): Promise<T> {
		const startedAt = Date.now();
		try {
			return await request();
		} finally {
			const durationMs = Date.now() - startedAt;
			const stats = this.requestPerformance.get(name) ?? { calls: 0, totalDurationMs: 0, lastDurationMs: 0 };
			stats.calls += 1;
			stats.totalDurationMs += durationMs;
			stats.lastDurationMs = durationMs;
			this.requestPerformance.set(name, stats);
		}
	}

	get size(): number {
		return this.requestPerformance.size;
	}

	entries(): IterableIterator<[string, RequestPerformance]> {
		return this.requestPerformance.entries();
	}
}

export const requestPerformanceService = new RequestPerformanceService();