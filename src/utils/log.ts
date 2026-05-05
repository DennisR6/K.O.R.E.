export const LogLevel = {
	INFO: 'INFO',
	WARN: 'WARN',
	ERROR: 'ERROR',
	DEBUG: 'DEBUG',
} as const

export class GameLogger {
	private static isEnabled = !true;

	private static getCallerInfo(): string {
		const stack = new Error().stack;
		if (!stack) return "unknown";

		const lines = stack.split("\n");
		const callerLine = lines.find(line =>
			!line.includes("log.ts") &&
			!line.includes("GameLogger") &&
			line.includes(":")
		) || "";

		const match = callerLine.match(/\/([^\/\s?:]+)(?:\?[^\s:]+)? :(\d+)/)
			|| callerLine.match(/([^\/\s?:]+)(?:\?[^\s:]+)?:(\d+):(\d+)/);

		if (match) {
			return `${match[1]}:${match[2]}`;
		}

		return "internal";
	}

	public static log(level: keyof typeof LogLevel, ...args: any[]) {
		const caller = this.getCallerInfo();
		const timestamp = new Date().toLocaleTimeString();

		if (typeof window !== 'undefined' && window.game?.logs) {
			//@ts-ignore
			window.game.logs.push({
				timestamp,
				level,
				caller,
				data: args
			});
		}

		if (!this.isEnabled) return;
		const color = this.getColor(level);
		console.log(
			`%c${level.toUpperCase()}%c ${caller}`,
			`background: ${color}; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;`,
			'color: gray; font-weight: normal;',
			...args
		);
	}

	private static getColor(level: keyof typeof LogLevel): string {
		switch (level) {
			case LogLevel.ERROR: return '#ff4d4d';
			case LogLevel.WARN: return '#ffcc00';
			case LogLevel.DEBUG: return '#22ff00';
			default: return '#00aaff';
		}
	}

	// Shortcut-Methoden
	public static info(...a: any[]) { this.log(LogLevel.INFO, ...a); }
	public static error(...a: any[]) { this.log(LogLevel.ERROR, ...a); }
	public static debug(...a: any[]) { this.log(LogLevel.DEBUG, ...a); }
}
