import type { Freshness } from "@/types";

// Which of several overlapping loads is allowed to write what it fetched.
//
// The workspace reloads from a lot of places at once — mount, the tab coming
// back into view, the Locked folder's relock timer, and every successful
// mutation — so two requests being in flight together is routine rather than
// exceptional. Responses come back in whatever order the network decides, and
// a slower earlier one landing last would put an older listing on screen: the
// file a person just renamed goes back to its old name, the item they just
// deleted reappears, and nothing on screen says so.
//
// Each load claims a token before it starts; only the newest token may write.
// Cancelling retires every token outstanding, which is what a route change or
// an unmount needs — the answer is for a place the person has left.
export function createFreshness(): Freshness {
  let latest = 0;
  return {
    begin: () => ++latest,
    isCurrent: (token) => token === latest,
    // Skipping a number leaves every token handed out so far behind it.
    cancel: () => {
      latest++;
    },
  };
}
