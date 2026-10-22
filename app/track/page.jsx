"use client";
const STEPS = ["placed", "packed", "dispatched", "delivered"];
export default function TrackTimeline({ order }) {
  const idx = STEPS.indexOf(order.status);
  return (
    <ol className="timeline">
      {STEPS.map((s, i) => (
        <li key={s} className={i <= idx ? "done" : ""}>
          <span className="dot">{i <= idx ? "✓" : i + 1}</span>
          {s[0].toUpperCase() + s.slice(1)}
        </li>
      ))}
    </ol>
  );
}
