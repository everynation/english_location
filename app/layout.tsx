import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: '영문주소 변환기 — 해외 사이트 주소 입력 가이드',
  description: '한글 주소를 입력하면 해외 사이트 주소 폼(Address Line 1, Address Line 2, City, Postal Code)에 무엇을 적어야 하는지 바로 알려드립니다.',
  keywords: ['영문주소', '영문주소변환', 'Address Line 1', 'Address Line 2', '해외직구 주소', '영문주소 변환기'],
  verification: { google: 'gUchXLdpXrq2vQndlJV7ztCTUH1Cy85Kb3gRITtmbII' },
  openGraph: {
    title: '영문주소 변환기',
    description: '한글 주소를 해외 사이트에 바로 쓸 수 있는 영문 주소로 변환합니다.',
    url: 'https://addressline1.com',
    siteName: '영문주소 변환기',
    images: [{ url: 'https://addressline1.com/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  alternates: { canonical: 'https://addressline1.com' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-B18H5QNHYB" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-B18H5QNHYB');
        `}</Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
