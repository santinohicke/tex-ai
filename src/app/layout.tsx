import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tex-ai-app.pages.dev";
const TITLE = "Tex AI — Asistente RAG de normativa financiera";
const DESCRIPTION =
  "Asistente RAG de normativa financiera, corriendo en mi homelab. Búsqueda híbrida, reranking y respuestas con citas verificadas.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Tex AI",
    title: TITLE,
    description: DESCRIPTION,
    locale: "es_AR",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Tex AI — Asistente RAG de normativa financiera" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col font-sans selection:bg-[#cc785c]/20 selection:text-[#141413]">
        {children}
      </body>
    </html>
  );
}
