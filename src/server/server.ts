import { type USERID } from "./db.js";
import type { UUID } from "crypto";


export function loginUser(userid: UUID | undefined): boolean {
	if (userid === undefined) return false
	// const query = DB.db.query("select userid from users where userid=?1")
	// const res = query.get(userid) as { userid: UUID } | null
	// if (!res) return false
	return true
}
export function loginUserFailed(): USERID {
	const newUserid = crypto.randomUUID()
	console.log("creating new User", newUserid)
	// addNewUser(newUserid); // TODO: Needs verification
	return newUserid as USERID
}
