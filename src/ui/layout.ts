export interface LayoutConfig {
	isMobile: boolean;
	scaleFactor: number;
	touchTargetPadding: number;
	uiFontSize: number;
}

export function calculateMobileLayout(screenWidth: number, screenHeight: number, baseWidth: number = 800, baseHeight: number = 450): LayoutConfig {
	const isMobile = screenWidth <= 768 || screenHeight <= 500;
	const widthRatio = screenWidth / baseWidth;
	const heightRatio = screenHeight / baseHeight;
	const baseScale = Math.min(widthRatio, heightRatio);

	const scaleFactor = isMobile ? Math.max(baseScale, 0.6) : baseScale;
	const touchTargetPadding = isMobile ? 16 : 8;
	const uiFontSize = isMobile ? 18 : 14;

	return {
		isMobile,
		scaleFactor,
		touchTargetPadding,
		uiFontSize,
	};
}

export function adaptCanvasSizeForViewport(windowWidth: number, windowHeight: number, baseWidth: number = 800, baseHeight: number = 450): { width: number; height: number; scale: number } {
	const layout = calculateMobileLayout(windowWidth, windowHeight, baseWidth, baseHeight);
	const width = baseWidth * layout.scaleFactor;
	const height = baseHeight * layout.scaleFactor;
	return {
		width,
		height,
		scale: layout.scaleFactor,
	};
}
