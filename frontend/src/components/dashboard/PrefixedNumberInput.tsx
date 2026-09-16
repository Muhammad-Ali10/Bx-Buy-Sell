import { useLayoutEffect, useRef, useState, type CSSProperties, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

/** Where the label sits, and the space left between it and the number. */
const EDGE = 12;
const GAP = 8;

/**
 * How much room the field must leave for the label inside it.
 *
 * The label used to be given a fixed 36px. That fits "$" or "%", but a seller
 * working in Swiss francs got "CHF" written straight over their own number,
 * because Intl has no symbol for that currency and returns the code itself.
 * Two-letter ones — "kr", "zl", "Kc" — were tight for the same reason. So the
 * label is measured instead, and measured again whenever its width changes:
 * the web font arrives after the first paint, and the currency itself changes
 * when the seller picks another one in Financials.
 */
const useAffixPadding = (affix?: string) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [padding, setPadding] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!affix) {
      setPadding(undefined);
      return;
    }
    let cancelled = false;
    const measure = () => {
      const node = ref.current;
      if (cancelled || !node) return;
      // Before the font loads — and in tests, which lay nothing out — the
      // width reads as zero; a character's worth each keeps the number clear
      // of the label until the real measurement lands.
      const width = node.getBoundingClientRect().width || affix.length * 10;
      setPadding(Math.round(EDGE + width + GAP));
    };
    measure();

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && ref.current) {
      observer = new ResizeObserver(measure);
      observer.observe(ref.current);
    }
    void (document as any)?.fonts?.ready?.then?.(measure);

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [affix]);

  return { ref, paddingLeft: padding };
};

type Props = Omit<ComponentProps<typeof Input>, "prefix"> & {
  /** What sits inside the field on the left: "%", or the seller's currency. */
  prefix?: string;
  prefixClassName?: string;
  prefixStyle?: CSSProperties;
};

/** A number field with its unit or currency inside it, on the left. */
export const PrefixedNumberInput = ({
  prefix,
  prefixClassName,
  prefixStyle,
  style,
  ...input
}: Props) => {
  const { ref, paddingLeft } = useAffixPadding(prefix);

  return (
    <div className="relative">
      {prefix ? (
        <span
          ref={ref}
          className={prefixClassName}
          style={{
            position: "absolute",
            left: `${EDGE}px`,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            ...prefixStyle,
          }}
        >
          {prefix}
        </span>
      ) : null}
      <Input
        {...input}
        style={
          prefix
            ? { ...style, paddingLeft: `${paddingLeft ?? EDGE + prefix.length * 10 + GAP}px` }
            : style
        }
      />
    </div>
  );
};

export default PrefixedNumberInput;
