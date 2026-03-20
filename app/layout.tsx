import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Statlab — Interactive DS/ML Learning',
  description:
    'Learn statistics and machine learning through hands-on interactive labs, not passive reading.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
