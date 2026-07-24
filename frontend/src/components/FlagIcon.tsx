import { getCountryCodeFromLocation } from "@/lib/countryUtils";

interface FlagIconProps {
  country: string;
  className?: string;
}

const FlagIcon = ({ country, className = "w-6 h-4" }: FlagIconProps) => {
  // Use the utility function to detect country code from location (city or country name)
  const countryCode = getCountryCodeFromLocation(country);

  return (
    <img
      src={`https://flagcdn.com/w20/${countryCode}.png`}
      srcSet={`https://flagcdn.com/w40/${countryCode}.png 2x`}
      alt={`${country} flag`}
      className={`inline-block object-cover ${className}`}
      loading="lazy"
      onError={(e) => {
        // Fallback to unknown flag if image fails to load
        const target = e.target as HTMLImageElement;
        target.src = `https://flagcdn.com/w20/un.png`;
      }}
    />
  );
};

export default FlagIcon;
