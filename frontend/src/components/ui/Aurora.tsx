"use client";

/** Animated colour field that sits behind every glass surface.
 *
 *  Fixed and non-interactive, so it never scrolls with content or eats a
 *  click. The blobs are plain blurred divs rather than a canvas: cheap, and
 *  they compose correctly with `backdrop-filter` above them, which is the
 *  whole point — a glass panel needs something worth refracting. */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] animate-drift rounded-full bg-cyan-500/20 blur-[110px]" />
      <div className="absolute -right-32 top-[-10%] h-[30rem] w-[30rem] animate-drift-slow rounded-full bg-violet-500/20 blur-[110px]" />
      <div className="absolute bottom-[-20%] left-1/3 h-[32rem] w-[32rem] animate-drift rounded-full bg-fuchsia-500/12 blur-[120px]" />
      {/* Fine grain over the gradients. Without it, large blurred areas band
          badly on 8-bit displays. */}
      <div
        className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
