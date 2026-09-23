// Stands in for the "server-only" marker package under Vitest.
//
// Its default entry throws so the module cannot reach a Client Component.
// Next resolves it to an empty module through the "react-server" export
// condition; vitest.config.mts aliases it here for the same reason. The
// package's own empty.js is not reachable — its exports map does not expose
// the subpath outside that condition.
export {};
