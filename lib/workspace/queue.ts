import type { UploadQueue } from "@/types";

// How often a held transfer looks again at whether the queue is running.
const POLL = 200;

// Pause and cancellation for the upload queue.
//
// Both are read where a transfer starts rather than where the queue is filled.
// A queue is filled in a single tick — every file of a dropped folder is
// handed over before the browser paints — so a gate checked there has already
// let the whole queue through by the time anyone can reach the pause control.
//
// The queue counts what it is holding, and the pause releases itself once that
// count reaches zero. The control that lifts a pause is only on screen while
// something is uploading, so a flag that outlived its queue would hold the
// next upload with nothing on screen to let it go.
export function createUploadQueue({
  onDrain,
  poll = POLL,
}: { onDrain?: () => void; poll?: number } = {}): UploadQueue {
  const cancelled = new Set<string>();
  let paused = false;
  let held = 0;
  return {
    cancel: (id) => void cancelled.add(id),
    restore: (id) => void cancelled.delete(id),
    cancelled: (id) => cancelled.has(id),
    paused: () => paused,
    toggle: () => (paused = !paused),
    async ready(id) {
      while (paused && !cancelled.has(id)) await new Promise((resume) => setTimeout(resume, poll));
      return !cancelled.has(id);
    },
    async queued(id, work) {
      held++;
      try {
        return await work();
      } finally {
        held--;
        if (!held) {
          paused = false;
          onDrain?.();
        }
      }
    },
  };
}
