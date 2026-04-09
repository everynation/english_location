export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="blog-nav">
        <a href="/">
          <img src="/logo.svg" alt="로고" width={24} height={24} />
          영문주소 변환기
        </a>
      </nav>
      {children}
    </>
  );
}
