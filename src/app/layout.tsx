import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pesos - Gestor de Hábitos, Finanzas y Ejercicios",
  description: "Tu panel personal moderno para hábitos, tareas, finanzas y bitácora.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-background text-foreground font-sans selection:bg-brand-indigo/30 selection:text-brand-indigo/80">
        {children}
      </body>
    </html>
  );
}

