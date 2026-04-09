'use client';

import { useState, useRef } from 'react';

interface Addr {
  country: string;
  dosi: string;
  city: string;
  line1: string;
  line2: string;
  postal: string;
}

interface JusoItem {
  roadAddr: string;
  roadAddrPart1?: string;
  jibunAddr?: string;
  zipNo: string;
}

function convertDetail(raw: string): string {
  if (!raw?.trim()) return '';
  const s = raw.trim();
  const basement = s.match(/지하\s*(\d+)\s*층/);
  const floor = s.match(/(\d+)\s*층/);
  const ho = s.match(/(\d+)\s*호/);
  const dong = s.match(/([A-Za-z가-힣\d]+)\s*동/);
  const parts: string[] = [];
  if (ho) parts.push(`#${ho[1]}`);
  if (dong) parts.push(`${dong[1]}-dong`);
  if (basement) parts.push(`B${basement[1]}F`);
  else if (floor) parts.push(`${floor[1]}F`);
  return parts.length ? parts.join(', ') : s;
}

function parseEnglish(roadAddr: string, zipNo: string) {
  const parts = roadAddr.split(',').map((s) => s.trim());
  let line1: string, city: string, dosi: string;
  if (parts.length >= 3) {
    dosi = parts[parts.length - 1];
    city = parts[parts.length - 2];
    line1 = parts.slice(0, -2).join(', ');
  } else if (parts.length === 2) {
    dosi = parts[1];
    city = parts[1];
    line1 = parts[0];
  } else {
    dosi = '';
    city = '';
    line1 = parts[0] || '';
  }
  return { dosi, city, line1, postal: zipNo };
}

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x={9} y={9} width={13} height={13} rx={2} />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export default function Home() {
  const [addr, setAddr] = useState<Addr>({
    country: 'South Korea', dosi: '', city: '', line1: '', line2: '', postal: '',
  });
  const [results, setResults] = useState<JusoItem[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noResult, setNoResult] = useState('');
  const [detailValue, setDetailValue] = useState('');
  const [koreanAddr, setKoreanAddr] = useState('');
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [copiedField, setCopiedField] = useState('');
  const [highlightField, setHighlightField] = useState('');
  const [copyAllDone, setCopyAllDone] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  function showToastMsg(msg = '복사되었습니다') {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 1800);
  }

  function copyText(text: string, field?: string) {
    navigator.clipboard.writeText(text).then(() => {
      if (field) {
        setCopiedField(field);
        setTimeout(() => setCopiedField(''), 1200);
      }
      showToastMsg();
    });
  }

  function highlight(field: string) {
    setHighlightField(field);
    setTimeout(() => setHighlightField(''), 800);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const kw = searchRef.current?.value.trim();
    if (!kw) return;
    setShowResults(true);
    setShowDetail(false);
    setLoading(true);
    setNoResult('');
    setResults([]);

    try {
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(kw)}`);
      const data = await res.json();
      if (data.error) { setNoResult(data.error); setLoading(false); return; }
      const list = data.results?.juso;
      if (!list?.length) { setNoResult('검색 결과가 없습니다. 주소를 다시 확인해 주세요.'); setLoading(false); return; }
      setResults(list);
    } catch { setNoResult('네트워크 오류가 발생했습니다.'); }
    setLoading(false);
  }

  async function selectAddress(juso: JusoItem) {
    try {
      const keyword = juso.roadAddrPart1 || juso.roadAddr;
      const res = await fetch(`/api/english?keyword=${encodeURIComponent(keyword)}`);
      const data = await res.json();
      const eng = data.results?.juso?.[0];
      if (!eng) { alert('영문 주소를 찾을 수 없습니다.'); return; }
      const parsed = parseEnglish(eng.roadAddr, eng.zipNo);
      const newAddr = { ...addr, ...parsed, line2: '' };
      setAddr(newAddr);
      setKoreanAddr(juso.roadAddr);
      setDetailValue('');
      setShowDetail(true);
      setShowResults(false);
      ['dosi', 'city', 'line1', 'postal'].forEach((f, i) => setTimeout(() => highlight(f), i * 150));
      if (window.innerWidth <= 800) {
        setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
      }
    } catch { alert('영문 주소 변환에 실패했습니다.'); }
  }

  function handleDetailChange(val: string) {
    setDetailValue(val);
    const converted = convertDetail(val);
    setAddr((prev) => ({ ...prev, line2: converted }));
    if (converted) highlight('line2');
  }

  function copyAll() {
    if (!addr.line1) return;
    const lines = [addr.line1];
    if (addr.line2) lines.push(addr.line2);
    lines.push(`${addr.city}, ${addr.dosi} ${addr.postal}`);
    lines.push(addr.country);
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyAllDone(true);
      setTimeout(() => setCopyAllDone(false), 1500);
      showToastMsg('전체 주소가 복사되었습니다');
    });
  }

  const fields: { key: keyof Addr; label: string; chevron?: boolean }[] = [
    { key: 'country', label: 'Country or region', chevron: true },
    { key: 'dosi', label: 'Do Si', chevron: true },
    { key: 'city', label: 'City' },
    { key: 'line1', label: 'Address line 1' },
    { key: 'line2', label: 'Address line 2' },
    { key: 'postal', label: 'Postal code' },
  ];

  return (
    <>
      <header className="hero">
        <img src="/logo.svg" alt="로고" className="hero-logo" />
        <h1>영문주소 변환기</h1>
        <p className="subtitle">한글 주소를 입력하면 해외 사이트 주소 폼에 뭘 적어야 하는지 바로 알려드립니다</p>
        <span className="trust-badge">행정안전부 도로명주소 공식 API</span>
      </header>

      <main className="layout">
        {/* LEFT: 폼 미리보기 */}
        <div className="col-preview" ref={previewRef}>
          <p className="col-label">해외 사이트에서 이렇게 보입니다</p>
          <div className="form-card">
            <div className="form-card-header">Edit address</div>
            {fields.map(({ key, label, chevron }) => (
              <div key={key} className={`pf${highlightField === key ? ' highlight' : ''}`}>
                <span className="pf-label">{label}</span>
                <div className="pf-body">
                  <span className={`pf-val${addr[key] ? ' filled' : ''}`}>
                    {addr[key] || '—'}
                  </span>
                  {chevron && (
                    <svg className="pf-chevron" viewBox="0 0 20 20">
                      <path d="M5 7l5 5 5-5" fill="none" stroke="currentColor" strokeWidth={1.5} />
                    </svg>
                  )}
                </div>
                <button
                  className={`pf-copy${copiedField === key ? ' copied' : ''}`}
                  onClick={() => addr[key] && copyText(addr[key], key)}
                  title="복사"
                >
                  <CopyIcon />
                </button>
              </div>
            ))}
          </div>
          <button className={`copy-all-btn${copyAllDone ? ' copied' : ''}`} disabled={!addr.line1} onClick={copyAll}>
            <CopyIcon />
            전체 복사
          </button>
        </div>

        {/* RIGHT: 한글 주소 입력 */}
        <div className="col-input">
          <p className="col-label">한글 주소를 검색하세요</p>
          <div className="input-card">
            <form className="search-bar" onSubmit={handleSearch}>
              <div className="search-wrap">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" />
                </svg>
                <input ref={searchRef} type="text" placeholder="도로명 또는 지번 주소" autoComplete="off" />
              </div>
              <button type="submit" id="searchBtn">검색</button>
            </form>
            <p className="search-hint">예: 강남대로 396, 주좌길 16, 세종대로 110</p>

            {showResults && (
              <div className="results">
                {loading && <div className="loading"><span className="spinner" />검색 중…</div>}
                {noResult && <div className="no-result">{noResult}</div>}
                {results.map((j, i) => (
                  <div key={i} className="result-item fade-up" style={{ animationDelay: `${i * 0.04}s` }} onClick={() => selectAddress(j)}>
                    <div className="r-road">{j.roadAddr}</div>
                    {j.jibunAddr && <div className="r-jibun">[지번] {j.jibunAddr}</div>}
                    <span className="r-zip">{j.zipNo}</span>
                  </div>
                ))}
              </div>
            )}

            {showDetail && (
              <div className="detail-section fade-up">
                <label className="detail-label">상세주소 <span>(동·호수·층)</span></label>
                <input
                  type="text"
                  className="detail-input"
                  placeholder="예: 101동 502호, 3층, 지하1층"
                  value={detailValue}
                  onChange={(e) => handleDetailChange(e.target.value)}
                />
                <div className="detail-examples">
                  <span>101동 502호 → #502, 101-dong</span>
                  <span>3층 → 3F</span>
                  <span>지하1층 → B1F</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 가이드 (SEO) */}
      <section className="guide">
        <h2>해외 주소 입력, 어디에 뭘 적어야 하나요?</h2>
        <div className="guide-grid">
          <article className="guide-item">
            <h3>Address Line 1 이란?</h3>
            <p>도로명과 건물번호를 영문으로 적는 칸입니다. 한국 주소의 &quot;OO길 123&quot; 부분이 여기에 해당합니다. 영문에서는 번호가 앞에 옵니다.</p>
            <div className="guide-ex">강남대로 396 → <strong>396 Gangnam-daero</strong></div>
          </article>
          <article className="guide-item">
            <h3>Address Line 2 란?</h3>
            <p>아파트 동·호수, 건물 층수 등 상세주소를 적는 칸입니다. 없으면 비워둬도 됩니다.</p>
            <div className="guide-ex">101동 502호 → <strong>#502, 101-dong</strong></div>
          </article>
          <article className="guide-item">
            <h3>City 에는 뭘 적나요?</h3>
            <p>시·군·구를 적는 칸입니다. 서울이라면 강남구, 경기도라면 성남시처럼 가장 구체적인 행정구역을 적습니다.</p>
            <div className="guide-ex">강남구 → <strong>Gangnam-gu</strong></div>
          </article>
          <article className="guide-item">
            <h3>Do Si / State 에는?</h3>
            <p>시·도를 적는 칸입니다. 서울, 부산 같은 광역시명이나 경기도 같은 도명을 적습니다.</p>
            <div className="guide-ex">서울특별시 → <strong>Seoul</strong></div>
          </article>
        </div>
      </section>

      <footer className="footer">
        <p>주소 데이터 출처: 행정안전부 도로명주소 안내시스템</p>
      </footer>

      <div className={`toast${toast.show ? ' show' : ''}`}>{toast.msg}</div>
    </>
  );
}
