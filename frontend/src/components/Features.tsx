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
        <div className="grid gap-4 md:grid-cols-[860fr_930fr]">
          {/* Two rows of equal height, as in Figma. A flex column shared the
              height out by content instead: 631px and 533px at 1920. */}
          <div className="flex flex-col gap-4 md:gap-[26px]">
            {/* Reports & Insights */}
            <div
              className="flex flex-col justify-center gap-4 max-h-[450px] h-full rounded-[20px] p-16 py-[40px] sm:gap-6 sm:rounded-[40px]  md:rounded-[60px] lg:rounded-[80px] xl:justify-start "
              style={{ backgroundColor: "rgb(24, 24, 26)" }}
            >
              <h2
                className="font-lufga text-white text-[28px] sm:text-[36px] md:text-[36px] lg:text-[44px] xl:text-[54px]"
                style={{ fontWeight: 400, lineHeight: 1.5 }}
              >
                Reports & Insights
              </h2>
              <p
                className="font-lufga max-w-[668px] text-base sm:text-base lg:text-xl xl:text-2xl"
                style={{ fontWeight: 400, lineHeight: 1.5, color: "rgba(255, 255, 255, 0.5)" }}
              >
                Our detailed dashboard insights clear up most questions early on — so you can focus on what really matters. With key metrics presented clearly, users spend less time searching and more time deciding
              </p>
            </div>

            {/* Download the app */}
            <div
              className="flex items-center justify-center max-h-[450px] h-full  rounded-[20px] p-10 py-[40px] sm:rounded-[40px]  md:rounded-[60px] lg:rounded-[80px]"
              style={{ backgroundColor: "#D6D6D6" }}
            >
              <img
                src={downloadAppCard}
                alt="Download Mobile App"
              
                // Full width up to its designed 370px. A fixed 370px width
                // kept the column from narrowing, so on a phone the whole
                // section ran off the right edge of the screen.
                className="block  max-h-[300px] h-full w-full max-w-[300px]"
                loading="lazy"
                decoding="async"
               
              />
            </div>
          </div>

          {/* The app on lime. The card keeps Figma's 860:1190 shape, and
              stretches with the row when the cards beside it need more room. */}
          <div>
            {/* Anchored to the bottom: the phone's shadow runs off the
                bottom and right edges, so any spare room has to go at the
                top, where the picture is plain lime. Centred, it left a
                visible line where the shadow stopped. */}
            <img
              src={reportsPhone}
              alt="Reports & Insights App"
           
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
