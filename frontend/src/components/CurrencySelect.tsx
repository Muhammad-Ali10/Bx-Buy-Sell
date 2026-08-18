import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CurrencyOption {
  code: string; // ISO 4217, e.g. "USD"
  symbol: string; // e.g. "$"
}

// Full list of ISO 4217 currencies via Intl (modern browsers), with a fallback.
const getCurrencyCodes = (): string[] => {
  try {
    const fn = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf;
    if (typeof fn === "function") {
      const codes = fn("currency");
      if (Array.isArray(codes) && codes.length) return codes;
    }
  } catch {
    /* fall through to fallback */
  }
  return [
    "USD", "EUR", "GBP", "PKR", "INR", "AED", "CAD", "AUD", "JPY", "CNY",
    "CHF", "SGD", "SAR", "TRY", "ZAR", "BRL", "MXN", "RUB", "NZD", "HKD",
  ];
};

const symbolFor = (code: string): string => {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
};

// Some currencies have no distinct symbol (Intl returns the code) — show it once.
const currencyLabel = (code: string, symbol: string): string =>
  symbol && symbol !== code ? `${code} ${symbol}` : code;

/** Currency symbol for a code (e.g. "USD" -> "$", "PKR" -> "Rs"). */
export const getCurrencySymbol = (code: string): string => symbolFor(code);

const CURRENCIES: CurrencyOption[] = getCurrencyCodes()
  .map((code) => ({ code, symbol: symbolFor(code) }))
  .sort((a, b) => a.code.localeCompare(b.code));

interface CurrencySelectProps {
  value?: string;
  onChange: (code: string) => void;
  className?: string;
}

export const CurrencySelect = ({
  value,
  onChange,
  className,
}: CurrencySelectProps) => {
  const [open, setOpen] = useState(false);
  const selected = CURRENCIES.find((c) => c.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "min-w-[110px] justify-between gap-2 rounded-full font-medium",
            className,
          )}
        >
          {selected ? currencyLabel(selected.code, selected.symbol) : "Currency"}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search currency..." />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            <CommandGroup>
              {CURRENCIES.map((c) => (
                <CommandItem
                  key={c.code}
                  value={`${c.code} ${c.symbol}`}
                  onSelect={() => {
                    onChange(c.code);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <span className="w-12 font-medium">{c.code}</span>
                  <span className="flex-1 text-muted-foreground">
                    {c.symbol && c.symbol !== c.code ? c.symbol : ""}
                  </span>
                  <Check
                    className={cn(
                      "h-4 w-4",
                      selected?.code === c.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CurrencySelect;
