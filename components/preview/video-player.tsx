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

  return <div ref={containerRef} className="video-player" data-vjs-player />;
}
