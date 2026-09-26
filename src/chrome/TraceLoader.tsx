type Props = {
  className?: string;
};

/**
 * Animação quadrada de carregamento: contorno com dash que percorre o
 * retângulo. Uso reservado para tasks (pill + preview).
 */
export function TraceLoader({
  className = "size-3.5 shrink-0 text-accent",
}: Props) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-loading-indicator="trace"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeWidth="2.5"
      viewBox="0 0 20 20"
    >
      <rect
        height="17.5"
        rx="4"
        width="17.5"
        x="1.25"
        y="1.25"
        opacity="0.2"
      />
      <rect
        className="zen-trace-dash"
        height="17.5"
        rx="4"
        width="17.5"
        x="1.25"
        y="1.25"
        strokeDasharray="16 47.133"
        strokeLinecap="butt"
      />
    </svg>
  );
}
