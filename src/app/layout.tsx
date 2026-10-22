import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tex AI",
  description: "Asistente inteligente de operaciones, normativas y soporte corporativo.",
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
