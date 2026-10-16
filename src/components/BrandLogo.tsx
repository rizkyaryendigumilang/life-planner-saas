import { cn } from "../lib/utils";
import brandMarkDark from "../assets/brand-mark.png";
import brandMarkWhite from "../assets/brand-mark-white.png";
import brandFullDark from "../assets/brand-full.png";
import brandFullWhite from "../assets/brand-full-white.png";

export interface BrandLogoProps {
  /**
   * "mark": only the wallet checkmark icon
   * "horizontal": icon inside rounded badge + "LifePlanner" text & subtitle
   * "full": stacked icon + "LifePlanner" official typography
   */
  variant?: "mark" | "horizontal" | "full";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  badgeClassName?: string;
  showSubtitle?: boolean;
  subtitle?: string;
  textClassName?: string;
}

const MARK_SIZES = {
  xs: "h-3.5 w-auto",
  sm: "h-5 w-auto",
  md: "h-6 w-auto",
  lg: "h-8 w-auto",
  xl: "h-12 w-auto",
};

const FULL_SIZES = {
  xs: "h-6 w-auto",
  sm: "h-8 w-auto",
  md: "h-11 w-auto",
  lg: "h-14 w-auto",
  xl: "h-20 w-auto",
};

const BADGE_SIZES = {
  xs: "h-6 w-6 rounded-lg",
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-xl",
  lg: "h-12 w-12 rounded-2xl",
  xl: "h-16 w-16 rounded-3xl",
};

export function BrandLogo({
  variant = "horizontal",
  size = "md",
  className,
  badgeClassName,
  showSubtitle = true,
  subtitle = "Personal workspace",
  textClassName,
}: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <span className={cn("inline-flex items-center justify-center shrink-0", className)}>
        <img
          src={brandMarkDark}
          alt="LifePlanner"
          className={cn(MARK_SIZES[size], "object-contain dark:hidden select-none")}
        />
        <img
          src={brandMarkWhite}
          alt="LifePlanner"
          className={cn(MARK_SIZES[size], "object-contain hidden dark:block select-none")}
        />
      </span>
    );
  }

  if (variant === "full") {
    return (
      <span className={cn("inline-flex flex-col items-center justify-center shrink-0", className)}>
        <img
          src={brandFullDark}
          alt="LifePlanner"
          className={cn(FULL_SIZES[size], "object-contain dark:hidden select-none")}
        />
        <img
          src={brandFullWhite}
          alt="LifePlanner"
          className={cn(FULL_SIZES[size], "object-contain hidden dark:block select-none")}
        />
      </span>
    );
  }

  // Horizontal variant (badge + text lockup)
  return (
    <div className={cn("flex items-center gap-2.5 text-left select-none", className)}>
      <span
        className={cn(
          "grid place-items-center border border-line/15 bg-surface shadow-xs shrink-0 transition hover:border-line/25",
          BADGE_SIZES[size],
          badgeClassName,
        )}
      >
        <img
          src={brandMarkDark}
          alt="LifePlanner"
          className={cn(MARK_SIZES[size], "object-contain dark:hidden")}
        />
        <img
          src={brandMarkWhite}
          alt="LifePlanner"
          className={cn(MARK_SIZES[size], "object-contain hidden dark:block")}
        />
      </span>
      <div className="flex flex-col min-w-0">
        <span
          className={cn(
            "font-bold tracking-tight text-ink leading-tight truncate",
            size === "xs" || size === "sm" ? "text-xs" : size === "lg" ? "text-base" : size === "xl" ? "text-lg" : "text-[14px]",
            textClassName,
          )}
        >
          LifePlanner
        </span>
        {showSubtitle && (
          <span className="text-[10px] text-ink-faint leading-tight mt-0.5 truncate">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default BrandLogo;
