import "./globals.css";

export const metadata = {
  title: "Hi there, I'm Tom",
  description: "Developer, Generalist, Architect",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
