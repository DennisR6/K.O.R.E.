/**
 * Zentrales Logging-System der Engine.
 * 
 * Der GameLogger bietet formatierte Konsolenausgaben und trackt automatisch,
 * aus welcher Datei der Log-Aufruf stammt. Zusätzlich werden Logs in 
 * `window.game.logs` für spätere Analysen (z.B. Remote-Debugging) gespeichert.
 */
export const LogLevel = {
	INFO: 'INFO',
	WARN: 'WARN',
	ERROR: 'ERROR',
	DEBUG: 'DEBUG',
	TRACE: 'TRACE',
} as const

export class GameLogger {
	/** 
	 * Schaltet die Konsolenausgabe global an/aus.
	 * @default false (Deaktiviert für Production-Performance)
	 */
	private static isEnabled = true;

	/**
		 * Extrahiert den Dateinamen und die Zeilennummer aus dem Stacktrace.
		 * Erlaubt es, im Log sofort zu sehen, wer die Nachricht gesendet hat (z.B. "physics.ts:42").
		 * @returns {string} Der Caller-String im Format "filename:line".
		 */
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

	/**
		 * Hauptmethode zum Loggen von Nachrichten.
		 * Formatiert die Ausgabe mit CSS-Farben in der Browser-Konsole.
		 * 
		 * @param level - Die Wichtigkeit des Logs (INFO, WARN, ERROR, DEBUG).
		 * @param args - Beliebige Datenobjekte, Strings oder Fehlermeldungen.
		 */
	public static log(level: keyof typeof LogLevel, ...args: any[]) {
		const caller = this.getCallerInfo();
		const timestamp = new Date().toLocaleTimeString();

		if (typeof window !== 'undefined' && window.game?.logs) {
			window.game.handler.logs.push({
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
			case LogLevel.TRACE: return '#2000ff';
			default: return '#00aaff';
		}
	}

	/** Loggt eine informative Nachricht (Blau). */
	public static info(...a: any[]) { this.log(LogLevel.INFO, ...a); }

	/** Loggt einen Fehler (Rot) - Sollte für kritische Probleme genutzt werden. */
	public static error(...a: any[]) { this.log(LogLevel.ERROR, ...a); }

	/** 
	 * Loggt Debug-Informationen (Grün). 
	 * Ideal für Physik-Werte oder State-Changes während der Entwicklung.
	 */
	public static debug(...a: any[]) { this.log(LogLevel.DEBUG, ...a); }
	public static trace(...a: any[]) { this.log(LogLevel.TRACE, ...a); }
}
