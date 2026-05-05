export interface RenderContext {
	WORLD_SIZE_X: number;
	WORLD_SIZE_Y: number;

	drawCircle(x: number, y: number, radius: number): void;
	drawRect(x: number, y: number, width: number, height: number): void;
	drawText(text: string, x: number, y: number, fontSize?: number): void;
	setFillColor(color: string): void;
	setStrokeColor(color: string): void;
	setStroke(weight: number): void;
	rotate(x: number): void;
	scale(x: number): void;
	translate(x: number, y: number): void;
	loadImage(url: string): void;
	drawImage(img: string, dx?: number, dy?: number, dWidth?: number, dHeight?: number, sx?: number, sy?: number, sWidth?: number, sHeight?: number): void;
	getScreenSize(): { width: number, height: number };
	clear(color?: string): void;
	push(): void;
	pop(): void;
	line(x: number, y: number, x1: number, x2: number): void;
	resizeCanvas(x: number, y: number): void;
	setScaleFactor(x: number): void;
	getScaleFactor(): number;
	toWorld(val: number): number;
	toPixel(val: number): number;
	windowScale(): number;
	beginClip(): void;
	endClip(): void;

}

export interface IRenderer {
	update(deltatime: number, globalfriction: number): void;
}
export interface IDrawer {
	draw(ctx: RenderContext): void;
}

export interface UIData {
	currentState: string;
	gameId: string;
	isMyTurn: boolean;
	activeItem: number;
}
export interface UIDrawer {
	draw(ctx: RenderContext, data: UIData): void;
}
