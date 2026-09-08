import { ChevronDown, Info } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getCurrencySymbol } from "@/components/CurrencySelect";
import {
  HEADER_CURRENCIES,
  setDisplayCurrency,
  useDisplayCurrency,
} from "@/lib/displayCurrency";

/**
 * The currency chip in the menu bar.
 *
 * The info icon is not decoration: a seller enters their figures in their own
 * currency and the site shows them unchanged, so the icon explains why picking
 * EUR here does not turn a dollar listing into a euro one.
 */
interface HeaderCurrencySelectProps {
  /** Set on the home page, whose blue hero needs light ink. */
  onDark?: boolean;
}

export const HeaderCurrencySelect = ({ onDark = false }: HeaderCurrencySelectProps) => {
  const code = useDisplayCurrency();
  const symbol = getCurrencySymbol(code);

  return (
    <div
      className="flex items-center gap-1 rounded-full pl-3 pr-2 py-1.5"
      style={{
        background: onDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
        color: onDark ? "rgba(255, 255, 255, 1)" : "rgba(0, 0, 0, 1)",
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 focus:outline-none">
          <span
            className="font-lufga text-[13px] font-medium leading-none whitespace-nowrap sm:text-sm"
          >
            {code} {symbol !== code ? symbol : ""}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {HEADER_CURRENCIES.map((option) => {
            const optionSymbol = getCurrencySymbol(option);
            return (
              <DropdownMenuItem
                key={option}
                onSelect={() => setDisplayCurrency(option)}
                className="cursor-pointer justify-between"
              >
                <span className="font-medium">{option}</span>
                <span className="text-muted-foreground">
                  {optionSymbol !== option ? optionSymbol : ""}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About currencies"
              className="flex items-center justify-center opacity-60 transition-opacity hover:opacity-100 focus:outline-none"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-xs">
            Each listing is shown in the currency its seller entered. Prices are
            not converted.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default HeaderCurrencySelect;
