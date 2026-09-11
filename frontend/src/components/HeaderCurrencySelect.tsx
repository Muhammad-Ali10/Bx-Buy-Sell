import { Fragment } from "react";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoHint } from "@/components/InfoHint";
import { getCurrencySymbol } from "@/components/CurrencySelect";
import {
  HEADER_CURRENCIES,
  POPULAR_CURRENCY_COUNT,
  setDisplayCurrency,
  useDisplayCurrency,
} from "@/lib/displayCurrency";
import { CURRENCY_CHOICE_NOTE } from "@/lib/listingMoney";

/**
 * The currency chooser, in the menu bar and again in the footer.
 *
 * Both read and write the same stored choice, so changing one changes the
 * other. The ⓘ says what the choice does: amounts across the site are
 * converted into it, approximately, while each listing's own currency stays
 * the binding price.
 */
interface HeaderCurrencySelectProps {
  /** Set on a dark background — the home page's blue hero, the black footer. */
  onDark?: boolean;
  /** Which way the explanation opens; up in the footer, at the foot of the page. */
  infoSide?: "top" | "bottom";
}

export const HeaderCurrencySelect = ({ onDark = false, infoSide = "bottom" }: HeaderCurrencySelectProps) => {
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
        <DropdownMenuTrigger
          className="flex items-center gap-1 focus:outline-none"
          aria-label="Currency to show prices in"
        >
          <span
            className="font-lufga text-[13px] font-medium leading-none whitespace-nowrap sm:text-sm"
          >
            {code} {symbol !== code ? symbol : ""}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 w-40 overflow-y-auto">
          {HEADER_CURRENCIES.map((option, index) => {
            const optionSymbol = getCurrencySymbol(option);
            return (
              <Fragment key={option}>
                {index === POPULAR_CURRENCY_COUNT && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onSelect={() => setDisplayCurrency(option)}
                  className="cursor-pointer justify-between"
                >
                  <span className="font-medium">{option}</span>
                  <span className="text-muted-foreground">
                    {optionSymbol !== option ? optionSymbol : ""}
                  </span>
                </DropdownMenuItem>
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <InfoHint label="About currencies" side={infoSide}>
        {CURRENCY_CHOICE_NOTE}
      </InfoHint>
    </div>
  );
};

export default HeaderCurrencySelect;
