import type { Metadata } from 'next';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '블로그 — 영문주소 변환기',
  description: '해외 직구, 영문주소 입력, Address Line 작성법 등 해외 주소 관련 가이드 모음',
  alternates: { canonical: 'https://addressline1.com/blog' },
};

function getBlogPosts() {
  const blogDir = join(process.cwd(), 'app/blog');
  if (!existsSync(blogDir)) return [];

  return readdirSync(blogDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(blogDir, d.name, 'page.tsx')))
    .map((d) => {
      const content = readFileSync(join(blogDir, d.name, 'page.tsx'), 'utf-8');
      const titleMatch = content.match(/headline:\s*'([^']+)'/);
      const dateMatch = content.match(/datePublished:\s*'([^']+)'/);
      return {
        slug: d.name,
        title: titleMatch?.[1] || d.name,
        date: dateMatch?.[1] || '',
      };
    })
    .sort((a, b) => (b.date > a.date ? 1 : -1));
}

export default function BlogIndex() {
  const posts = getBlogPosts();

  return (
    <div className="blog-index">
      <h1>블로그</h1>
      <p className="blog-index-desc">해외 직구·배송에 필요한 영문주소 가이드</p>
      {posts.length === 0 ? (
        <p className="blog-empty">아직 작성된 글이 없습니다.</p>
      ) : (
        <ul className="blog-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`}>
                <span className="blog-list-title">{post.title}</span>
                {post.date && <time>{post.date}</time>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="blog-back">
        <Link href="/">← 영문주소 변환기로 돌아가기</Link>
      </div>
    </div>
  );
}
