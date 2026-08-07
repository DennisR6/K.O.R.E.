import type { RenderContext } from "../../engine/RenderContext.js";
import { KoreMenuStyle } from "./menuVocabulary.js";

export type UiElementState = "normal" | "hover" | "active" | "focused" | "disabled";

export interface UiStyleToken {
  background: string;
  backgroundAlpha?: number;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  textColor: string;
  textOutlineColor?: string;
  textOutlineWidth?: number;
  fontSize: number;
}

export interface UiElementTheme {
  normal: UiStyleToken;
  hover: UiStyleToken;
  active: UiStyleToken;
  focused: UiStyleToken;
  disabled: UiStyleToken;
}

const BLUE_BUTTON_THEME: UiElementTheme = {
  normal: {
    background: "#1d4ed8",
    backgroundAlpha: 0,
    borderColor: "#60a5fa",
    borderWidth: 2,
    borderRadius: 12,
    textColor: "#ffffff",
    fontSize: 20,
  },
  hover: {
    background: "#2563eb",
    backgroundAlpha: 0,
    borderColor: "#f97316",
    borderWidth: 3,
    borderRadius: 12,
    textColor: "#ffffff",
    fontSize: 20,
  },
  active: {
    background: "#1e40af",
    backgroundAlpha: 0,
    borderColor: "#ea580c",
    borderWidth: 2,
    borderRadius: 12,
    textColor: "#cbd5e1",
    fontSize: 20,
  },
  focused: {
    background: "#2563eb",
    backgroundAlpha: 0,
    borderColor: "#fb923c",
    borderWidth: 3,
    borderRadius: 12,
    textColor: "#ffffff",
    fontSize: 20,
  },
  disabled: {
    background: "#334155",
    backgroundAlpha: 0,
    borderColor: "#475569",
    borderWidth: 1,
    borderRadius: 12,
    textColor: "#94a3b8",
    fontSize: 20,
  },
};

const BACK_BUTTON_THEME: UiElementTheme = {
  normal: {
    background: "#0f172a",
    backgroundAlpha: 0,
    borderColor: "#334155",
    borderWidth: 2,
    borderRadius: 12,
    textColor: "#cbd5e1",
    fontSize: 18,
  },
  hover: {
    background: "#1e293b",
    backgroundAlpha: 0,
    borderColor: "#f97316",
    borderWidth: 3,
    borderRadius: 12,
    textColor: "#ffffff",
    fontSize: 18,
  },
  active: {
    background: "#020617",
    backgroundAlpha: 0,
    borderColor: "#ea580c",
    borderWidth: 2,
    borderRadius: 12,
    textColor: "#94a3b8",
    fontSize: 18,
  },
  focused: {
    background: "#1e293b",
    backgroundAlpha: 0,
    borderColor: "#fb923c",
    borderWidth: 3,
    borderRadius: 12,
    textColor: "#ffffff",
    fontSize: 18,
  },
  disabled: {
    background: "#020617",
    backgroundAlpha: 0,
    borderColor: "#1e293b",
    borderWidth: 1,
    borderRadius: 12,
    textColor: "#475569",
    fontSize: 18,
  },
};

function coloredButton(background: string, borderColor: string, textColor = "#ffffff", fontSize = 24): UiElementTheme {
	const token = (fill: string, border: string, alpha = 0.75): UiStyleToken => ({ background: fill, backgroundAlpha: alpha, borderColor: border, borderWidth: 2, borderRadius: 18, textColor, fontSize });
	return {
		normal: token(background, borderColor),
		hover: token(background, "#ffffff", 0.9),
		active: token("#020617", borderColor, 0.95),
		focused: token(background, "#ffffff", 0.9),
		disabled: token("#111827", "#334155", 0.5),
	};
}

/**
 * Registered KORE button themes. Any style authored by the KORE UI vocabulary
 * resolves here; unknown style values are rejected instead of being silently
 * remapped to a valid button style.
 */
export const KORE_UI_THEME: Record<string, UiElementTheme> = {
  [KoreMenuStyle.MainButton]: BLUE_BUTTON_THEME,
  [KoreMenuStyle.OnlineButton]: coloredButton("#07141f", "#42e8ff"),
  [KoreMenuStyle.LocalButton]: coloredButton("#151024", "#a78bfa"),
  [KoreMenuStyle.SettingsButton]: coloredButton("#20170d", "#fb923c"),
  [KoreMenuStyle.CreditsButton]: coloredButton("#211b08", "#facc15"),
  [KoreMenuStyle.MapRow]: BLUE_BUTTON_THEME,
  [KoreMenuStyle.Back]: BACK_BUTTON_THEME,
};

/** Resolves an authored element style to its registered theme; unknown styles are rejected at this boundary. */
export function resolveKoreButtonTheme(style: string | undefined): UiElementTheme {
  if (style === undefined || !(style in KORE_UI_THEME)) throw new Error(`Unknown KORE UI button style '${String(style)}'`);
  return KORE_UI_THEME[style]!;
}

export class Canvas2DUiRenderer {
  constructor(private readonly ctx: RenderContext) { }

  public drawButton(
    rect: { x: number; y: number; width: number; height: number },
    text: string,
    styleKey: string | undefined,
    state: UiElementState
  ): void {
    const themeGroup = resolveKoreButtonTheme(styleKey);
    const style = themeGroup[state] ?? themeGroup.normal;

    this.ctx.push();

    // 1. INNEN-BODY
    this.ctx.push();
    this.drawSeamlessRoundedRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      style.borderRadius,
      style.background,
      style.backgroundAlpha
    );
    this.ctx.pop();

    // 2. AUSSEN-BORDER
    if (style.borderWidth > 0 && style.borderColor !== "transparent") {
      this.ctx.setNoFill();
      this.ctx.setStrokeColor(style.borderColor);
      this.ctx.setStroke(style.borderWidth);
      this.ctx.drawRect(rect.x, rect.y, rect.width, rect.height, style.borderRadius);
    }

    // 3. TEXT: wrap long labels at word boundaries and center every line.
    if (text) {
      const textOutlineWidth = style.textOutlineWidth ?? 0;
      if (textOutlineWidth > 0 && style.textOutlineColor) {
        this.ctx.setStrokeColor(style.textOutlineColor);
        this.ctx.setStroke(textOutlineWidth);
      } else {
        this.ctx.noStroke();
      }
      this.ctx.setFillColor(style.textColor);
      const lines = wrapButtonLabel(text, rect.width - 16, value => this.ctx.getTextWidth(value, style.fontSize));
      const lineHeight = style.fontSize * 1.1;
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      lines.forEach((line, index) => {
        const textWidth = this.ctx.getTextWidth(line, style.fontSize);
        const textX = Math.round(centerX - textWidth / 2);
        const textY = Math.round(centerY + (index - (lines.length - 1) / 2) * lineHeight + style.fontSize * 0.25);
        this.ctx.drawText(line, textX, textY, style.fontSize);
      });
    }

    this.ctx.pop();
  }

  private drawSeamlessRoundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: string,
    alpha?: number
  ): void {
    this.ctx.noStroke();
    this.ctx.setFillColor(color, alpha);
    this.ctx.drawRect(x, y, w, h, r);
  }
}

function wrapButtonLabel(text: string, maxWidth: number, measure: (value: string) => number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length > 1 && lines.some(value => measure(value) > maxWidth)
    ? [text]
    : lines;
}
