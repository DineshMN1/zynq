import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "ZynqCloud",
  description: "Secure, fast, and completely self-hosted file storage with role-based access control and team collaboration.",
};

/**
 * Root layout component that initializes the persisted theme and provides authentication and theme contexts for the application.
 *
 * @param children - The application content to render inside the layout.
 * @returns An HTML document tree with a head script that applies the persisted theme and a body that wraps `children` with `AuthProvider` and `ThemeProvider`.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}