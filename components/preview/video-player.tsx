"use client";

import { useEffect, useRef } from "react";
import videojs from "video.js";

import "video.js/dist/video-js.css";

import { transportStreamPlaylist } from "@/components/preview/transport-stream";

type Player = ReturnType<typeof videojs>;

export function VideoPlayer({
  src,
  type,
  size,
  title,
}: {
  src: string;
  type?: string;
  size: number;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Video.js rewrites the element it's given, so it's created outside React.
    const el = document.createElement("video-js");
    el.classList.add("vjs-big-play-centered");
    el.setAttribute("aria-label", title);
    container.appendChild(el);
    const player = videojs(el, {
      controls: true,
      fill: true,
      preload: "auto",
      playsinline: true,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      userActions: { hotkeys: true },
      // Always use Video.js's own HLS engine: it's what plays .ts files,
      // and Safari's native player can't load a blob playlist.
      html5: { vhs: { overrideNative: true } },
    });
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, [title]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (type !== "video/mp2t") {
      player.src({ src, type });
      return;
    }
    let active = true;
    let playlist: string | undefined;
    transportStreamPlaylist(src, size)
      .then((url) => {
        playlist = url;
        if (active) player.src({ src: url, type: "application/x-mpegURL" });
        else URL.revokeObjectURL(url);
      })
      .catch(() => {
        if (active) player.error("This video couldn't be read. Try downloading it.");
      });
    return () => {
      active = false;
      if (playlist) URL.revokeObjectURL(playlist);
    };
  }, [src, type, size, title]);

  // Video.js renders its own DOM and ships unlayered CSS, so its overrides
  // target its class names and need `!` to beat that stylesheet.
  return (
    <div
      ref={containerRef}
      className="h-full w-full max-w-[1200px] overflow-hidden rounded-[12px] bg-black [&_.video-js]:font-sans! [&_.video-js:hover_.vjs-big-play-button]:bg-black/70! [&_.vjs-big-play-button]:[margin:-36px_0_0_-36px]! [&_.vjs-big-play-button]:size-[72px]! [&_.vjs-big-play-button]:rounded-full! [&_.vjs-big-play-button]:border-0! [&_.vjs-big-play-button]:bg-black/50! [&_.vjs-big-play-button]:text-[3.5em]! [&_.vjs-big-play-button]:leading-[72px]! [&_.vjs-big-play-button]:backdrop-blur-[6px] [&_.vjs-big-play-button:focus]:bg-black/70! [&_.vjs-button>.vjs-icon-placeholder::before]:leading-[1.8]! [&_.vjs-control-bar]:h-[3.6em]! [&_.vjs-control-bar]:px-2! [&_.vjs-control-bar]:[background:linear-gradient(transparent,rgb(0_0_0/0.75))]! [&_.vjs-load-progress_div]:bg-white/35! [&_.vjs-progress-control_.vjs-play-progress]:bg-white! [&_.vjs-slider]:bg-white/25! [&_.vjs-time-control]:leading-[3.6em]! [&_.vjs-volume-level]:bg-white!"
      data-vjs-player
    />
  );
}
