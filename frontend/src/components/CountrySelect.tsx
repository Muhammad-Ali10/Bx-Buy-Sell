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
}

export const CountrySelect = ({
  value,
  onChange,
  placeholder = "Select country",
  className,
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
            !value && "text-muted-foreground",
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
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
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
