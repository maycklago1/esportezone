import { sportLabel } from "@/lib/quadra/format";
import { cn } from "@/lib/utils";

export function CourtMark({ sport, className }: { sport: string; className?: string }) {
  const net = sport === "tenis" || sport === "beach" || sport === "padel" || sport === "volei" || sport === "futevolei";
  return (
    <div className={cn("relative overflow-hidden bg-pine text-mist", className)}>
      <div className="absolute inset-3 border border-mist/50" />
      {net ? <div className="absolute inset-x-3 top-1/2 h-px bg-mist/70" /> : null}
      {!net ? (
        <>
          <div className="absolute inset-y-3 left-1/2 w-px bg-mist/60" />
          <div className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-mist/60" />
        </>
      ) : null}
      <span className="absolute bottom-3 left-4 text-xs font-medium tracking-wide">{sportLabel(sport)}</span>
    </div>
  );
}
