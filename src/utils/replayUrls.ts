/** Uses the page's deployment directory, preserving path-mounted apps such as `/kore/`. */
function applicationBase(pageUrl: string): URL {
	const base = new URL(pageUrl);
	base.search = "";
	base.hash = "";
	if (!base.pathname.endsWith("/")) base.pathname += "/";
	return base;
}

export function buildReplayShareEndpoint(pageUrl: string, token: string): string {
	return new URL(`replays/${token}`, applicationBase(pageUrl)).toString();
}

export function buildReplayViewerUrl(pageUrl: string, token: string): string {
	const viewer = applicationBase(pageUrl);
	viewer.searchParams.set("replay", token);
	return viewer.toString();
}
