import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";

const SITE_URL = "https://madstoq.com";
const SITE_NAME = "MADSToQ IT Solutions";
const SITE_TITLE =
  "MADSToQ | IT SaaS & IT Services Provider in Ahmedabad";
const SITE_DESCRIPTION =
  "MADSToQ IT Solutions — IT SaaS and IT services provider in Ahmedabad, Gujarat. Inventory, Inward-Outward, PMC costing, and custom business software for operations.";

const SEO_KEYWORDS: string[] = [
  "MADSToQ",
  "MADSTOQ",
  "IT SaaS provider",
  "best IT SaaS provider",
  "IT services provider in Ahmedabad",
  "SaaS company Ahmedabad",
  "IT company Gujarat",
  "inventory software",
  "Inward-Outward",
  "custom software Ahmedabad",
  "business software India",
  "PMC",
  "RMC",
  "digital transformation",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/MADSToQ.png`,
        width: 680,
        height: 373,
        alt: `${SITE_NAME} — IT SaaS & IT services in Ahmedabad`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/MADSToQ.png`],
  },
  other: {
    "geo.region": "IN-GJ",
    "geo.placename": "Ahmedabad",
    ICBM: "23.0225, 72.5714",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: ["MADSToQ", "MADSTOQ", "madstoq.com"],
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      inLanguage: "en-IN",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": ["Organization", "LocalBusiness", "ProfessionalService"],
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: ["MADSToQ", "MADSTOQ", "madstoq.com"],
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      email: "inquires@madstoq.com",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Ahmedabad",
        addressRegion: "Gujarat",
        addressCountry: "IN",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 23.0225,
        longitude: 72.5714,
      },
      areaServed: [
        { "@type": "City", name: "Ahmedabad" },
        { "@type": "State", name: "Gujarat" },
        { "@type": "Country", name: "India" },
      ],
      knowsAbout: [
        "IT SaaS",
        "IT services",
        "Inventory management software",
        "Inward-Outward software",
        "Product costing",
        "Custom software development",
      ],
      logo: {
        "@type": "ImageObject",
        "@id": `${SITE_URL}/#logo`,
        url: `${SITE_URL}/favicon-192.png`,
        contentUrl: `${SITE_URL}/favicon-192.png`,
        width: 192,
        height: 192,
        caption: SITE_NAME,
      },
      image: `${SITE_URL}/MADSToQ.png`,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: "inquires@madstoq.com",
        areaServed: ["Ahmedabad", "Gujarat", "IN"],
        availableLanguage: ["English", "Hindi", "Gujarati"],
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48" />
        <link rel="icon" href="/favicon-192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <meta name="application-name" content={SITE_NAME} />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
