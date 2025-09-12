// ImageSlider.jsx
'use client'
import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import Image from "next/image";


const ImageSlider = () => {
  const images = [
    "/wallstreetonline.png",
    "/wallstreetonline.png",
    "/wallstreetonline.png",
    "/wallstreetonline.png",
    "/wallstreetonline.png",
    "/wallstreetonline.png",
    "/wallstreetonline.png",
    "/wallstreetonline.png",
   
  ];

  return (
    <div className="!bg-[#F8F8F8] pb-4">

    <div  style={{ width: "90%", margin: "0 auto", paddingTop: "2rem" }}>
      <Swiper
        modules={[Autoplay]}
        slidesPerView={5}
        spaceBetween={20}
        loop={true}
        autoplay={{
          delay: 2500,
          disableOnInteraction: false,
        }}
        breakpoints={{
          0: { slidesPerView: 1 },
          600: { slidesPerView: 2 },
          900: { slidesPerView: 3 },
          1200: { slidesPerView: 5 },
        }}
      >
        {images.map((src, index) => (
          <SwiperSlide key={index}>
            <Image
            width={300}
            height={100}
              src={src}
              alt={`Slide ${index}`}
              className="sm:aspect-square sm: md:aspect-[42/9] mx-auto"
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>

    </div>
  );
};

export  {ImageSlider};
