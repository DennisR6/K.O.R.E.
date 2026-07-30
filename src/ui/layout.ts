export interface LayoutConfig {
	isMobile: boolean;
	isSteamDeck: boolean;
	isLargeDesktop: boolean;
	scaleFactor: number;
	touchTargetPadding: number;
	uiFontSize: number;
}

export function isSteamDeckViewport(width: number, height: number): boolean {
	return (width === 1280 && height === 800) || (width >= 1200 && width <= 1300 && height >= 750 && height <= 850);
}

export function calculateDesktopLayout(screenWidth: number, screenHeight: number, baseWidth: number = 800, baseHeight: number = 450): LayoutConfig {
	const steamDeck = isSteamDeckViewport(screenWidth, screenHeight);
	const largeDesktop = screenWidth >= 1920 || screenHeight >= 1080;
	const isMobile = screenWidth <= 768 || screenHeight <= 500;

	const widthRatio = screenWidth / baseWidth;
	const heightRatio = screenHeight / baseHeight;
	let baseScale = Math.min(widthRatio, heightRatio);

	if (steamDeck) {
		// Steam deck optimal UI scaling
		baseScale = Math.min(widthRatio, heightRatio) * 0.85;
	} else if (largeDesktop) {
		// Cap scale on massive displays to avoid excessive element size
		baseScale = Math.min(baseScale, 2.5);
	}

	const scaleFactor = Math.max(baseScale, 0.5);
	const touchTargetPadding = isMobile ? 16 : (steamDeck ? 12 : 8);
	const uiFontSize = isMobile ? 18 : (steamDeck || screenWidth >= 2560 ? 16 : 14);

	return {
		isMobile,
		isSteamDeck: steamDeck,
		isLargeDesktop: largeDesktop,
		scaleFactor,
		touchTargetPadding,
		uiFontSize,
	};
}

export function calculateMobileLayout(screenWidth: number, screenHeight: number, baseWidth: number = 800, baseHeight: number = 450): LayoutConfig {
	return calculateDesktopLayout(screenWidth, screenHeight, baseWidth, baseHeight);
}

export function adaptCanvasSizeForViewport(windowWidth: number, windowHeight: number, baseWidth: number = 800, baseHeight: number = 450): { width: number; height: number; scale: number } {
	const layout = calculateDesktopLayout(windowWidth, windowHeight, baseWidth, baseHeight);
	const width = baseWidth * layout.scaleFactor;
	const height = baseHeight * layout.scaleFactor;
	return {
		width,
		height,
		scale: layout.scaleFactor,
	};
}
