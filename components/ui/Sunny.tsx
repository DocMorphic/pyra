"use client";

/**
 * Sunny — Pyra's mascot. A solar hedgehog: the spikes double as sun rays.
 * Flat, friendly, PostHog-illustration energy. Inline SVG so it themes
 * with currentColor-free explicit fills and scales crisply.
 */
export function Sunny({
  size = 96,
  mood = "happy",
}: {
  size?: number;
  mood?: "happy" | "worried";
}) {
  const spikes = Array.from({ length: 11 });
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      {/* sun-ray / quill spikes around the upper body */}
      <g stroke="#f54e00" strokeWidth="3" strokeLinecap="round">
        {spikes.map((_, i) => {
          const a = (-200 + (i * 220) / (spikes.length - 1)) * (Math.PI / 180);
          const cx = 60 + 34 * Math.cos(a);
          const cy = 66 + 34 * Math.sin(a);
          const ex = 60 + 50 * Math.cos(a);
          const ey = 66 + 50 * Math.sin(a);
          return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} />;
        })}
      </g>

      {/* body */}
      <ellipse cx="60" cy="68" rx="40" ry="36" fill="#f7a501" stroke="#151515" strokeWidth="3" />
      {/* warm belly */}
      <ellipse cx="60" cy="78" rx="26" ry="22" fill="#ffd699" />

      {/* feet */}
      <ellipse cx="44" cy="103" rx="7" ry="5" fill="#f54e00" stroke="#151515" strokeWidth="2.5" />
      <ellipse cx="76" cy="103" rx="7" ry="5" fill="#f54e00" stroke="#151515" strokeWidth="2.5" />

      {/* face */}
      <circle cx="49" cy="66" r="4.5" fill="#151515" />
      <circle cx="71" cy="66" r="4.5" fill="#151515" />
      <circle cx="50.5" cy="64.5" r="1.4" fill="#fff" />
      <circle cx="72.5" cy="64.5" r="1.4" fill="#fff" />
      {/* nose */}
      <circle cx="60" cy="74" r="3" fill="#151515" />
      {/* cheeks */}
      <circle cx="42" cy="76" r="4" fill="#f35454" opacity="0.5" />
      <circle cx="78" cy="76" r="4" fill="#f35454" opacity="0.5" />
      {/* mouth */}
      {mood === "happy" ? (
        <path d="M53 80 Q60 86 67 80" stroke="#151515" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M53 84 Q60 79 67 84" stroke="#151515" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}
