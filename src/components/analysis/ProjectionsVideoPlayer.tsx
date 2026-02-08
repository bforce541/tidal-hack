import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";

type YearJump = { year: number; seconds: number };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function formatTime(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const whole = Math.max(0, Math.floor(s));
  const m = Math.floor(whole / 60);
  const sec = whole % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function ProjectionsVideoPlayer(props: {
  src: string;
  trimEndSeconds?: number; // seconds removed from the end of the file
  yearJumps?: YearJump[];
  autoPreview?: boolean; // loop preview until user interacts
}) {
  const trimEndSeconds = props.trimEndSeconds ?? 2.04;
  const yearJumps: YearJump[] = props.yearJumps ?? [
    { year: 2007, seconds: 0 },
    { year: 2015, seconds: 2 },
    { year: 2022, seconds: 4 },
    { year: 2030, seconds: 6 },
  ];
  const autoPreview = props.autoPreview ?? true;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [trimmedEnd, setTrimmedEnd] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [muted, setMuted] = useState(autoPreview);

  const effectiveEnd = useMemo(() => {
    if (trimmedEnd != null) return trimmedEnd;
    if (duration == null) return null;
    return Math.max(0, duration - trimEndSeconds);
  }, [duration, trimEndSeconds, trimmedEnd]);

  const isPreviewing = autoPreview && !hasInteracted;
  const atEnd = effectiveEnd != null && currentTime >= Math.max(0, effectiveEnd - 0.05);

  const ensureInteractive = () => {
    if (hasInteracted) return;
    setHasInteracted(true);
    const v = videoRef.current;
    if (v) {
      v.muted = false;
      setMuted(false);
      if (!v.paused) v.pause();
    }
    return true;
  };

  const seekAndPause = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    ensureInteractive();
    const end = effectiveEnd ?? v.duration;
    const next = clamp(t, 0, Number.isFinite(end) ? end : t);
    v.currentTime = next;
    v.pause();
    setCurrentTime(next);
    setIsPlaying(false);
  };

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    // First interaction stops the looping preview and leaves the video paused.
    if (ensureInteractive()) return;
    if (effectiveEnd != null && v.currentTime >= Math.max(0, effectiveEnd - 0.05)) {
      v.currentTime = 0;
      setCurrentTime(0);
    }
    if (v.paused) {
      try {
        await v.play();
      } catch {
        // autoplay policies / transient failures; leave paused
      }
    } else {
      v.pause();
    }
  };

  const setRate = (rate: number) => {
    const v = videoRef.current;
    ensureInteractive();
    const r = clamp(rate, 0.25, 3);
    setPlaybackRate(r);
    if (v) v.playbackRate = r;
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = () => {
      const d = Number.isFinite(v.duration) ? v.duration : null;
      setDuration(d);
      if (d != null) setTrimmedEnd(Math.max(0, d - trimEndSeconds));
      // Start preview from the beginning.
      v.currentTime = 0;
    };

    const onTime = () => {
      const end = effectiveEnd ?? (Number.isFinite(v.duration) ? Math.max(0, v.duration - trimEndSeconds) : null);
      const t = v.currentTime;

      // Enforce "trim" so the last ~2s never show.
      if (end != null && t > end) {
        if (isPreviewing) {
          v.currentTime = 0;
          void v.play().catch(() => {});
          setCurrentTime(0);
          return;
        }
        v.currentTime = end;
        v.pause();
        setCurrentTime(end);
        setIsPlaying(false);
        return;
      }

      // Preview loops at the trimmed end.
      if (isPreviewing && end != null && t >= Math.max(0, end - 0.05)) {
        v.currentTime = 0;
        void v.play().catch(() => {});
        setCurrentTime(0);
        return;
      }

      setCurrentTime(t);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);

    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [effectiveEnd, isPreviewing, trimEndSeconds]);

  // Ensure preview mode is muted + tries to play.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!isPreviewing) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    setMuted(true);
    void v.play().catch(() => {});
  }, [isPreviewing]);

  const scrubMax = effectiveEnd ?? 0;
  const scrubValue = effectiveEnd != null ? clamp(currentTime, 0, effectiveEnd) : currentTime;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/80 overflow-hidden bg-black">
        <div className="relative">
          <video
            ref={videoRef}
            src={props.src}
            className="w-full aspect-video"
            playsInline
            preload="metadata"
            onClick={togglePlay}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-md border border-border/80 bg-background p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying ? "Pause" : atEnd ? "Restart" : "Play"}
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              {formatTime(currentTime)}{effectiveEnd != null ? ` / ${formatTime(effectiveEnd)}` : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Speed</span>
          {[1, 2].map((r) => (
            <Button
              key={r}
              variant={Math.abs(playbackRate - r) < 0.01 ? "default" : "outline"}
              size="sm"
              className="font-mono"
              onClick={() => setRate(r)}
            >
              {r}x
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Jump</span>
            {yearJumps.map((j) => (
              <Button key={j.year} variant="secondary" size="sm" className="font-mono" onClick={() => seekAndPause(j.seconds)}>
                {j.year}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground">selecting a year pauses at that frame</span>
          </div>

          <div className="flex items-center gap-3">
            <input
              className="w-full accent-primary"
              type="range"
              min={0}
              max={effectiveEnd != null ? scrubMax : 0}
              step={0.01}
              value={effectiveEnd != null ? scrubValue : 0}
              disabled={effectiveEnd == null}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                ensureInteractive();
                const next = Number(e.target.value);
                v.currentTime = next;
                v.pause();
                setIsPlaying(false);
                setCurrentTime(next);
              }}
            />
            <span className="text-xs text-muted-foreground font-mono w-12 text-right">{formatTime(currentTime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
