import type { RenderContext } from "../../engine/RenderContext.js";

export type UiElementState = "normal" | "hover" | "active" | "focused" | "disabled";

export interface UiStyleToken {
  background: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  textColor: string;
  fontSize: number;
}

export interface UiElementTheme {
  normal: UiStyleToken;
  hover: UiStyleToken;
  active: UiStyleToken;
  focused: UiStyleToken;
  disabled: UiStyleToken;
}

export const KORE_UI_THEME: Record<string, UiElementTheme> = {
  "kore.button.blue": {
    normal: {
      background: "#1d4ed8",
      borderColor: "#60a5fa",
      borderWidth: 2,
      borderRadius: 12,
      textColor: "#ffffff",
      fontSize: 20,
    },
    hover: {
      background: "#2563eb",
      borderColor: "#f97316",
      borderWidth: 3,
      borderRadius: 12,
      textColor: "#ffffff",
      fontSize: 20,
    },
    active: {
      background: "#1e40af",
      borderColor: "#ea580c",
      borderWidth: 2,
      borderRadius: 12,
      textColor: "#cbd5e1",
      fontSize: 20,
    },
    focused: {
      background: "#2563eb",
      borderColor: "#fb923c",
      borderWidth: 3,
      borderRadius: 12,
      textColor: "#ffffff",
      fontSize: 20,
    },
    disabled: {
      background: "#334155",
      borderColor: "#475569",
      borderWidth: 1,
      borderRadius: 12,
      textColor: "#94a3b8",
      fontSize: 20,
    },
  },

  "kore.button.blue-back": {
    normal: {
      background: "#0f172a",
      borderColor: "#334155",
      borderWidth: 2,
      borderRadius: 12,
      textColor: "#cbd5e1",
      fontSize: 18,
    },
    hover: {
      background: "#1e293b",
      borderColor: "#f97316",
      borderWidth: 3,
      borderRadius: 12,
      textColor: "#ffffff",
      fontSize: 18,
    },
    active: {
      background: "#020617",
      borderColor: "#ea580c",
      borderWidth: 2,
      borderRadius: 12,
      textColor: "#94a3b8",
      fontSize: 18,
    },
    focused: {
      background: "#1e293b",
      borderColor: "#fb923c",
      borderWidth: 3,
      borderRadius: 12,
      textColor: "#ffffff",
      fontSize: 18,
    },
    disabled: {
      background: "#020617",
      borderColor: "#1e293b",
      borderWidth: 1,
      borderRadius: 12,
      textColor: "#475569",
      fontSize: 18,
    },
  },
};

export class Canvas2DUiRenderer {
  constructor(private readonly ctx: RenderContext) {}

  public drawButton(
    rect: { x: number; y: number; width: number; height: number },
    text: string,
    styleKey: string,
    state: UiElementState
  ): void {
    const themeGroup = KORE_UI_THEME[styleKey] ?? KORE_UI_THEME["kore.button.blue"]!;
    const style = themeGroup[state] ?? themeGroup.normal;

    this.ctx.push();

    // 1. AUSSEN-BORDER
    if (style.borderWidth > 0 && style.borderColor !== "transparent") {
      this.drawSeamlessRoundedRect(
        rect.x - style.borderWidth,
        rect.y - style.borderWidth,
        rect.width + style.borderWidth * 2,
        rect.height + style.borderWidth * 2,
        style.borderRadius + style.borderWidth,
        style.borderColor
      );
    }

    // 2. INNEN-BODY
    this.drawSeamlessRoundedRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      style.borderRadius,
      style.background
    );

    // 3. TEXT: wrap long labels at word boundaries and center every line.
    if (text) {
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
    color: string
  ): void {
		this.ctx.noStroke();
		this.ctx.setFillColor(color);
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
