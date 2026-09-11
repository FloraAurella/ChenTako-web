import type { ElementType, HTMLAttributes } from "react";
import { icon, pearLogo } from "../../resources/icons/index.js";

interface TrustedIconProps extends HTMLAttributes<HTMLElement> {
  name: string;
  size: number;
  as?: ElementType;
}

export function TrustedIcon({ name, size, as: Tag = "span", ...props }: TrustedIconProps) {
  return <Tag {...props} dangerouslySetInnerHTML={{ __html: icon(name, size) }} />;
}

export function TrustedLogo({ size, ...props }: { size: number } & HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} dangerouslySetInnerHTML={{ __html: pearLogo(size) }} />;
}
