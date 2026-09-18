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
 * The currency chooser, in the menu bar of the public pages and again in the
 * footer. The portal screens beside a sidebar leave it out of their bar, as
 * the design does. Every copy reads and writes the same stored choice, so
 * changing one changes the others. The ⓘ says what the choice does: amounts across the site are
 * converted into it, approximately, while each listing's own currency stays
 * the binding price.
 */
interface HeaderCurrencySelectProps {
  /** Set on a dark background — the home page's blue hero, the black footer. */
  onDark?: boolean;
  /** Which way the explanation opens; up in the footer, at the foot of the page. */
  infoSide?: "top" | "bottom";
  /**
   * "bar" is the light grey pill the menu bar wears. "footer" is the outlined
   * dark chip the design gives it under the footer's Currency label — same
   * stored choice, different skin.
   */
  variant?: "bar" | "footer";
}

export const HeaderCurrencySelect = ({
  onDark = false,
  infoSide = "bottom",
  variant = "bar",
}: HeaderCurrencySelectProps) => {
  const code = useDisplayCurrency();
  const symbol = getCurrencySymbol(code);
  const isFooter = variant === "footer";

  return (
    <div
      className="inline-flex items-center justify-between gap-1 rounded-full pl-3 pr-2 py-1.5"
      style={{
        background: isFooter ? "rgba(255, 255, 255, 0.06)" : "#D8D8D8",
        border: isFooter ? "1px solid rgba(255, 255, 255, 0.2)" : undefined,
        color: isFooter ? "#FFFFFF" : "#000000",
        width: isFooter ? "150px" : undefined,
        display: "inline-flex",
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center justify-between w-full gap-1 focus:outline-none"
          aria-label="Currency to show prices in"
        >
          <span
            className="font-lufga text-[13px] font-medium leading-none whitespace-nowrap sm:text-sm"
          >
            {code} {symbol !== code ? symbol : ""}
          </span>
         <ChevronDown className="h-3 w-3" />
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

          {isFooter ?  null  :  <InfoHint label="About currencies" side={infoSide}>
        {CURRENCY_CHOICE_NOTE}
      </InfoHint>}
    </div>
  );
};

export default HeaderCurrencySelect;
