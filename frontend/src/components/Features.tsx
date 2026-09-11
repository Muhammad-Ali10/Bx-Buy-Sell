import reportsPhone from "@/assets/reports-insights-phone-2x.png";
import downloadAppCard from "@/assets/download-app-card-2x.png";

/**
 * "Reports & Insights", laid out as on the Figma home page (node 187:69719).
 *
 * At 1920px the columns are 930px and 860px with a 16px gap and 57px either
 * side; the lime card is 860 × 1190 and the two cards beside it share its
 * height. The section used to sit in a 1152px box, which is what made the
 * tiles look squeezed.
 *
 * Both pictures are Figma's own exports at twice their size, so they stay
 * sharp on high-density screens. The right one is the whole lime card with
 * the phone and its shadow: exported alone, the phone's shading renders black
 * instead of over the lime. Its corners carry the lime and the shadow on
 * rather than being cut round, so the card's own rounding can clip it at any
 * size without leaving an edge.
 */
const Features = () => {
  return (
    <section className="bg-black text-white py-12 sm:py-16 md:py-20">
      <div className="mx-auto w-full max-w-[1870px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-[930fr_860fr]">
          {/* Two rows of equal height, as in Figma. A flex column shared the
              height out by content instead: 631px and 533px at 1920. */}
          <div className="grid min-w-0 grid-rows-[1fr_1fr] gap-4 md:gap-[26px]">
            {/* Reports & Insights */}
            <div
              className="flex flex-col justify-center gap-4 min-h-[280px] rounded-[20px] p-6 sm:min-h-[360px] sm:gap-6 sm:rounded-[40px] sm:p-10 md:rounded-[60px] lg:rounded-[80px] xl:justify-start xl:gap-[31px] xl:pb-12 xl:pl-[84px] xl:pr-12 xl:pt-[99px]"
              style={{ backgroundColor: "rgb(24, 24, 26)" }}
            >
              <h2
                className="font-lufga text-white text-[28px] sm:text-[36px] md:text-[36px] lg:text-[44px] xl:text-[54px]"
                style={{ fontWeight: 400, lineHeight: 1.5 }}
              >
                Reports & Insights
              </h2>
              <p
                className="font-lufga max-w-[668px] text-base sm:text-lg lg:text-xl xl:text-2xl"
                style={{ fontWeight: 400, lineHeight: 1.5, color: "rgba(255, 255, 255, 0.5)" }}
              >
                Our detailed dashboard insights clear up most questions early on — so you can focus on what really matters. With key metrics presented clearly, users spend less time searching and more time deciding
              </p>
            </div>

            {/* Download the app */}
            <div
              className="flex items-center justify-center overflow-hidden min-h-[300px] rounded-[20px] p-6 sm:min-h-[400px] sm:rounded-[40px] md:min-h-[460px] md:rounded-[60px] lg:rounded-[80px]"
              style={{ backgroundColor: "#1364ff" }}
            >
              <img
                src={downloadAppCard}
                alt="Download Mobile App"
                width={370}
                height={411}
                // Full width up to its designed 370px. A fixed 370px width
                // kept the column from narrowing, so on a phone the whole
                // section ran off the right edge of the screen.
                className="block h-auto w-full max-w-[370px]"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          {/* The app on lime. The card keeps Figma's 860:1190 shape, and
              stretches with the row when the cards beside it need more room. */}
          <div
            className="relative w-full min-w-0 aspect-[860/1190] overflow-hidden rounded-[20px] sm:rounded-[40px] md:self-stretch md:rounded-[60px] lg:rounded-[80px]"
            style={{ backgroundColor: "#c6fe1e" }}
          >
            {/* Anchored to the bottom: the phone's shadow runs off the
                bottom and right edges, so any spare room has to go at the
                top, where the picture is plain lime. Centred, it left a
                visible line where the shadow stopped. */}
            <img
              src={reportsPhone}
              alt="Reports & Insights App"
              width={860}
              height={1190}
              className="absolute inset-0 h-full w-full object-contain object-bottom"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
