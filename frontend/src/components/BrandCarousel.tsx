import brandWallstreet from "@/assets/brand-wallstreet.png";
import brandAdhoc from "@/assets/brand-adhoc.png";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const BrandCarousel = () => {
  const brands = [
    { name: "Wallstreet Online", logo: brandWallstreet },
    { name: "AD HOC NEWS", logo: brandAdhoc },
    { name: "DER STANDARD", logo: brandWallstreet },
    { name: "Merkur.de", logo: brandAdhoc },
    { name: "Süddeutsche Zeitung", logo: brandWallstreet },
    { name: "Generalanzeiger", logo: brandAdhoc },
    { name: "Wallstreet Online", logo: brandWallstreet },
    { name: "AD HOC NEWS", logo: brandAdhoc },
  ];

  return (
    <section className="bg-white pb-8 sm:pb-12 pt-0 border-t-0 border-b border-border/50 mt-0">
      <div className="container mx-auto px-4 sm:px-6">
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          plugins={[
            Autoplay({
              delay: 2000,
            }),
          ]}
          className="w-full"
        >
          <CarouselContent className="-ml-2 sm:-ml-4">
            {brands.map((brand, index) => (
              <CarouselItem
                key={index}
                className="pl-2 sm:pl-4 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/6"
              >
                <div className="h-10 sm:h-12 flex items-center justify-center grayscale hover:grayscale-0 transition-all duration-300">
                  <img
                    src={brand.logo}
                    alt={brand.name}
                    className="h-full w-auto object-contain opacity-70"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
};

export default BrandCarousel;
