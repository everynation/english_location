import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('keyword');
  const page = req.nextUrl.searchParams.get('page') || '1';
  const key = process.env.JUSO_SEARCH_KEY;

  if (!keyword) return NextResponse.json({ error: '검색어를 입력하세요' }, { status: 400 });
  if (!key) return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 });

  try {
    const url = `https://business.juso.go.kr/addrlink/addrLinkApi.do?confmKey=${key}&currentPage=${page}&countPerPage=10&keyword=${encodeURIComponent(keyword)}&resultType=json`;
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: '주소 검색에 실패했습니다' }, { status: 500 });
  }
}
