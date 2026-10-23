
"use client";

const STEPS = ["placed", "packed", "dispatched", "delivered"];

export default function TrackTimeline({ order }) {
  // Safely handle a missing order or status.
  const status =
    typeof order?.status === "string"
      ? order.status.toLowerCase()
      : "";

  const idx = STEPS.indexOf(status);

  return (
    <ol className="timeline">
      {STEPS.map((step, i) => (
        <li
          key={step}
          className={idx >= 0 && i <= idx ? "done" : ""}
        >
          <span className="dot">
            {idx >= 0 && i <= idx ? "✓" : i + 1}
          </span>
          {step[0].toUpperCase() + step.slice(1)}
        </li>
      ))}
    </ol>
  );
}
