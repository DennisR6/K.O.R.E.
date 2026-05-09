export function getIdOrUUUID(): string {
	if (typeof window === 'undefined') return crypto.randomUUID()
	const uuid = crypto.randomUUID()
	window.localStorage.setItem("userid", uuid)
	return uuid
}
