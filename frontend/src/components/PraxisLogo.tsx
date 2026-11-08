/** Praxis brand: a "P" mark with a spark (theory turned into practice) and the wordmark. */
export function PraxisMark({ size = 40 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Praxis" style={{ flexShrink: 0, filter: "drop-shadow(0 6px 14px rgba(67,97,238,.4))" }}>
    <defs>
      <linearGradient id="praxis-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4361EE" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient>
      <linearGradient id="praxis-spark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FDE68A" /><stop offset="1" stopColor="#F59E0B" /></linearGradient>
    </defs>
    <rect width="48" height="48" rx="13" fill="url(#praxis-bg)" />
    <path d="M15 36V12h11.2c5.6 0 9.3 3.4 9.3 8.4s-3.7 8.4-9.3 8.4H21.4V36z M21.4 23.4h4.5c2.3 0 3.6-1.1 3.6-3s-1.3-3-3.6-3h-4.5z" fill="#fff" fillRule="evenodd" />
    <path d="M37 6.5l1.5 3.6 3.6 1.5-3.6 1.5L37 16.7l-1.5-3.6-3.6-1.5 3.6-1.5z" fill="url(#praxis-spark)" />
  </svg>;
}

export default function PraxisLogo({ size = 40, tagline = true, light = true }: { size?: number; tagline?: boolean; light?: boolean }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.3) }}>
    <PraxisMark size={size} />
    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05, textAlign: "left" }}>
      <span style={{
        fontSize: Math.round(size * 0.58), fontWeight: 800, letterSpacing: "-0.03em",
        background: light ? "linear-gradient(90deg,#FFFFFF 0%,#C7D2FE 100%)" : "linear-gradient(90deg,#14213D 0%,#4361EE 100%)",
        WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
      }}>Praxis</span>
      {tagline && <span style={{ fontSize: Math.max(10, Math.round(size * 0.27)), fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", marginTop: 3, color: light ? "rgba(255,255,255,.55)" : "#6B7280" }}>Docencia con IA</span>}
    </span>
  </span>;
}
