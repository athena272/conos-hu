import logo from "../../assets/images/logo.png";

type BrandMarkProps = {
  subtitle?: string;
  tone?: "default" | "onDark";
  /** Larger logo for the sticky header bar */
  size?: "sm" | "md";
};

export function BrandMark({
  subtitle = "Estoque e pacientes",
  tone = "default",
  size = "sm",
}: BrandMarkProps) {
  const className = tone === "onDark" ? "brand brand--on-dark" : "brand";
  const imgSize = size === "md" ? 52 : 44;

  return (
    <div className={className}>
      <img
        src={logo}
        alt=""
        className="brand-mark-img"
        width={imgSize}
        height={imgSize}
      />
      <div className="brand-text">
        <strong>Conos</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
    </div>
  );
}
