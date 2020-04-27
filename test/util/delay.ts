/** Wait for some time. */
export default function (ms: number) { return new Promise(ok => setTimeout(ok, ms)) }
