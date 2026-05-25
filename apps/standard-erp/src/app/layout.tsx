import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";

const SITE_URL = "https://madstoq.com";
/** Brand label shown in Google site name (keep short; see WebSite schema). */
const SITE_NAME = "MADSToQ";
const SITE_NAME_LONG = "MADSToQ IT Solutions";
/** Primary SEO title: includes brand + target query terms (keep ~60 chars for snippets). */
const SITE_TITLE =
  "MADSToQ | IT Solutions, SaaS & Business Software";
const SITE_DESCRIPTION =
  "MADSToQ is an IT solutions and SaaS provider: Inventory and Inward-Outward software, custom business software, and cloud platforms for operations, compliance, and traceability.";

const SEO_KEYWORDS: string[] = [
  "MADSToQ",
  "MADSTOQ",
  "madstoq",
  "IT",
  "information technology",
  "IT solutions",
  "IT company",
  "business software",
  "software",
  "software solutions",
  "SaaS",
  "SaaS provider",
  "cloud software",
  "enterprise software",
  "operations software",
  "custom software",
  "inventory software",
  "Inward-Outward",
  "stock management",
  "traceability",
  "digital transformation",
];

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  alternates: {
    canonical: SITE_URL,
  },
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
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/MADSToQ.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — IT solutions, SaaS & business software`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/MADSToQ.png`],
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

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: [SITE_NAME_LONG, "MADSTOQ"],
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    inLanguage: "en-US",
    publisher: { "@id": `${SITE_URL}/#organization` },
    keywords: SEO_KEYWORDS.join(", "),
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: [SITE_NAME_LONG, "MADSTOQ"],
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    knowsAbout: [
      "Information technology",
      "IT solutions",
      "SaaS",
      "Business software",
      "Cloud software",
      "Inventory management software",
      "Operations management",
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
    image: {
      "@id": `${SITE_URL}/#logo`,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "inquires@madstoq.com",
      availableLanguage: ["English"],
    },
    sameAs: [],
  },
  {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${SITE_URL}/#professional-service`,
    name: `${SITE_NAME_LONG} — IT solutions & SaaS`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    serviceType: [
      "Software as a Service (SaaS)",
      "IT consulting and software development",
      "Business process software",
    ],
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed: {
      "@type": "Place",
      name: "Worldwide",
    },
  },
];

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

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />

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
