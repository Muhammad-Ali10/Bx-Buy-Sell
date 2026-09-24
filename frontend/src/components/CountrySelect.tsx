import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { countries } from "countries-list";

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

interface CountryOption {
  code: string; // ISO2 code, e.g. "US"
  name: string; // e.g. "United States"
}

// Full country list (252 countries), sorted alphabetically by name.
const COUNTRIES: CountryOption[] = Object.entries(countries)
  .map(([code, data]) => ({ code, name: (data as { name: string }).name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const flagUrl = (code: string) =>
  `https://flagcdn.com/w20/${code.toLowerCase()}.png`;

interface CountrySelectProps {
  /** Currently selected country name (matches what is stored in the form). */
  value?: string;
  /** Called with the selected country name. */
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * A first entry meaning "any country", for a filter rather than a form.
   *
   * Choosing it clears the value (`onChange("")`), and the button shows this
   * label while nothing is chosen — as a real choice, not as a greyed-out
   * placeholder.
   */
  allOption?: string;
  /**
   * What the button reads while nothing is chosen. Defaults to `allOption`,
   * else `placeholder`; the All Listings sidebar keeps its "Select location".
   */
  emptyLabel?: string;
  /** The list drawn dark, for the All Listings filter sidebar. */
  dark?: boolean;
}

export const CountrySelect = ({
  value,
  onChange,
  placeholder = "Select country",
  className,
  allOption,
  emptyLabel,
  dark = false,
}: CountrySelectProps) => {
  const [open, setOpen] = useState(false);

  const selected = COUNTRIES.find(
    (c) => c.name.toLowerCase() === (value ?? "").toLowerCase(),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-muted/50 font-normal",
            !value && !allOption && "text-muted-foreground",
            className,
          )}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <img
                src={flagUrl(selected.code)}
                alt=""
                className="w-5 h-4 shrink-0 rounded-sm object-cover"
                loading="lazy"
              />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : value ? (
            // Preserve any previously saved value that isn't an exact match.
            <span className="truncate">{value}</span>
          ) : (
            emptyLabel ?? allOption ?? placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[var(--radix-popover-trigger-width)] p-0",
          dark && "border-gray-700 bg-[rgba(24,24,26,1)] text-white",
        )}
        align="start"
      >
        <Command
          className={cn(
            dark &&
              "bg-transparent text-white [&_[cmdk-input-wrapper]]:border-gray-700 [&_[cmdk-input]]:text-white [&_[cmdk-input]]:placeholder:text-white/40",
          )}
        >
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {allOption && (
                <CommandItem
                  value={allOption}
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <span className="w-5 shrink-0" />
                  <span className="flex-1 truncate">{allOption}</span>
                  <Check
                    className={cn("h-4 w-4 shrink-0", !value ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              )}
              {COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  value={country.name}
                  onSelect={() => {
                    onChange(country.name);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <img
                    src={flagUrl(country.code)}
                    alt=""
                    className="w-5 h-4 shrink-0 rounded-sm object-cover"
                    loading="lazy"
                  />
                  <span className="flex-1 truncate">{country.name}</span>
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selected?.code === country.code
                        ? "opacity-100"
                        : "opacity-0",
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

export default CountrySelect;
