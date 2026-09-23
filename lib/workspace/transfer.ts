import type { TransferSlots } from "@/types";

// What a browser→bucket transfer is allowed to be, and what to say when one
// fails. Client-safe on purpose: the browser refuses an impossible file before
// it moves a byte, and the server actions hold the same ceiling as authority.

// The largest object a single PUT can carry. S3 refuses a single request over
// 5 GB, and R2's single-part limit is 4.995 GiB; 5 GB decimal is under both.
// Everything here goes up in one request — multipart is deliberately not part
// of this path — so this is the real ceiling, not a policy choice.
export const MAX_UPLOAD = 5 * 1000 ** 3;

export const TOO_LARGE = "Files can be up to 5 GB.";

export const oversize = (size: number) => size > MAX_UPLOAD;

// How many files transfer at once. A presigned URL is signed when a slot
// opens, and S3 checks it when the request starts rather than throughout, so
// bounding the slots is what keeps a long queue's last file from starting
// against a URL signed for its first. Browsers allow about six connections per
// host, and previews and downloads reach for the same bucket.
export const MAX_TRANSFERS = 4;

// A fixed number of transfer slots. A finished transfer hands its slot to
// whoever is waiting rather than releasing it and letting the next caller race
// for it — two transfers claiming one slot is how the cap would be exceeded.
export function createSlots(limit = MAX_TRANSFERS): TransferSlots {
  const waiting: (() => void)[] = [];
  let active = 0;
  return {
    async run<T>(work: () => Promise<T>): Promise<T> {
      if (active < limit) active++;
      else await new Promise<void>((open) => waiting.push(open));
      try {
        return await work();
      } finally {
        const next = waiting.shift();
        if (next) next();
        else active--;
      }
    },
  };
}

// The browser saw no response at all: DNS, the connection, or a bucket that
// answered without the CORS headers the browser needed to read it. What it is
// not is a rejection, which arrives with a status.
export const NETWORK_FAILURE = "Couldn't reach storage. Check your connection and try again.";

// Storage answered and said no. The status is the only thing that names what
// actually happened — a signature that expired reads differently from a bucket
// policy — so it goes in the message.
export const storageRejected = (status: number, statusText?: string) =>
  `Storage rejected the upload (${status}${statusText ? ` ${statusText}` : ""}).`;
