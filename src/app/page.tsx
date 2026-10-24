import { AppShell } from "@/components/app-shell";

const restaurantJsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "NAREX Foods",
  slogan: "Good Food. Great Taste. Made with Care.",
  servesCuisine: "Ghanaian",
  telephone: "+233559291195",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Mampong-Akuapem",
    addressRegion: "Eastern Region",
    addressCountry: "GH",
  },
  acceptsReservations: "False",
  hasMenu: {
    "@type": "Menu",
    hasMenuSection: [
      {
        "@type": "MenuSection",
        name: "Traditional Dishes",
        hasMenuItem: [
          {
            "@type": "MenuItem",
            name: "Yam / Plantain / Rice with Palava Sauce",
            offers: [
              { "@type": "Offer", name: "Small", price: "20.00", priceCurrency: "GHS" },
              { "@type": "Offer", name: "Medium", price: "25.00", priceCurrency: "GHS" },
              { "@type": "Offer", name: "Large", price: "30.00", priceCurrency: "GHS" },
            ],
          },
          {
            "@type": "MenuItem",
            name: "Rice Balls with Groundnut Soup",
            offers: [{ "@type": "Offer", price: "30.00", priceCurrency: "GHS" }],
          },
        ],
      },
      {
        "@type": "MenuSection",
        name: "Rice Dishes",
        hasMenuItem: [
          {
            "@type": "MenuItem",
            name: "Jollof Rice",
            offers: [
              { "@type": "Offer", name: "With egg", price: "25.00", priceCurrency: "GHS" },
              { "@type": "Offer", name: "With chicken", price: "35.00", priceCurrency: "GHS" },
            ],
          },
        ],
      },
    ],
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }}
      />
      <AppShell />
    </>
  );
}
