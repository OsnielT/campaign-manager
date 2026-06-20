import type { CSSProperties } from "react";
import './stemflowLogo.css'

type StemflowLogoProps = {
  width?: number | string;
  className?: string;
  animated?: boolean;
  ariaLabel?: string;
};

export default function StemflowLogo({
  width = 130,
  className = "",
  animated = true,
  ariaLabel = "Stemflow logo",
}: StemflowLogoProps) {
  const style: CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
  };

  return (
    <div
      className={`stemflow-logo-mask ${animated ? "is-animated" : ""} ${className}`}
      style={style}
      aria-label={ariaLabel}
      role="img"
    />
  );
}