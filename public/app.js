// ── State ──────────────────────────────────────
const addr = {
  country: 'South Korea',
  dosi: '',
  city: '',
  line1: '',
  line2: '',
  postal: '',
};

// ── DOM ────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const searchForm    = $('#searchForm');
const searchInput   = $('#searchInput');
const resultsList   = $('#resultsList');
const detailSection = $('#detailSection');
const detailInput   = $('#detailInput');
const copyAllBtn    = $('#copyAllBtn');

// ── 상세주소 한→영 변환 ───────────────────────
function convertDetail(raw) {
  if (!raw || !raw.trim()) return '';
  const s = raw.trim();

  const basement = s.match(/지하\s*(\d+)\s*층/);
  const floor    = s.match(/(\d+)\s*층/);
  const ho       = s.match(/(\d+)\s*호/);
  const dong     = s.match(/([A-Za-z가-힣\d]+)\s*동/);

  const parts = [];
  if (ho)         parts.push(`#${ho[1]}`);
  if (dong)       parts.push(`${dong[1]}-dong`);
  if (basement)   parts.push(`B${basement[1]}F`);
  else if (floor) parts.push(`${floor[1]}F`);

  return parts.length ? parts.join(', ') : s;
}

// ── 영문주소 파싱 ─────────────────────────────
function parseEnglish(roadAddr, zipNo) {
  const parts = roadAddr.split(',').map(s => s.trim());

  let line1, city, dosi;
  if (parts.length >= 3) {
    dosi  = parts[parts.length - 1];
    city  = parts[parts.length - 2];
    line1 = parts.slice(0, -2).join(', ');
  } else if (parts.length === 2) {
    dosi  = parts[1];
    city  = parts[1];
    line1 = parts[0];
  } else {
    dosi  = '';
    city  = '';
    line1 = parts[0] || '';
  }

  return { dosi, city, line1, postal: zipNo };
}

// ── 폼 미리보기 업데이트 ──────────────────────
function updatePreview() {
  const fields = { dosi: addr.dosi, city: addr.city, line1: addr.line1, line2: addr.line2, postal: addr.postal };

  Object.entries(fields).forEach(([key, val]) => {
    const el = $(`#val-${key}`);
    if (!el) return;
    const filled = !!val;
    el.textContent = filled ? val : '—';
    el.classList.toggle('filled', filled);

    // highlight animation
    const pf = el.closest('.pf');
    if (filled) {
      pf.classList.add('highlight');
      setTimeout(() => pf.classList.remove('highlight'), 800);
    }
  });

  copyAllBtn.disabled = !addr.line1;
}

// ── 검색 ──────────────────────────────────────
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const kw = searchInput.value.trim();
  if (!kw) return;

  resultsList.classList.remove('hidden');
  resultsList.innerHTML = '<div class="loading"><span class="spinner"></span>검색 중…</div>';
  detailSection.classList.add('hidden');

  try {
    const res = await fetch(`/api/search?keyword=${encodeURIComponent(kw)}`);
    const data = await res.json();

    if (data.error) {
      resultsList.innerHTML = `<div class="no-result">${data.error}</div>`;
      return;
    }

    const list = data.results?.juso;
    if (!list || !list.length) {
      resultsList.innerHTML = '<div class="no-result">검색 결과가 없습니다. 주소를 다시 확인해 주세요.</div>';
      return;
    }

    resultsList.innerHTML = list.map((j, i) => `
      <div class="result-item fade-up" style="animation-delay:${i * .04}s" data-idx="${i}">
        <div class="r-road">${j.roadAddr}</div>
        ${j.jibunAddr ? `<div class="r-jibun">[지번] ${j.jibunAddr}</div>` : ''}
        <span class="r-zip">${j.zipNo}</span>
      </div>
    `).join('');

    resultsList.querySelectorAll('.result-item').forEach(el => {
      el.addEventListener('click', () => selectAddress(list[parseInt(el.dataset.idx)]));
    });
  } catch {
    resultsList.innerHTML = '<div class="no-result">네트워크 오류가 발생했습니다.</div>';
  }
});

// ── 주소 선택 → 영문 변환 ─────────────────────
async function selectAddress(juso) {
  try {
    const keyword = juso.roadAddrPart1 || juso.roadAddr;
    const res = await fetch(`/api/english?keyword=${encodeURIComponent(keyword)}`);
    const data = await res.json();

    const eng = data.results?.juso?.[0];
    if (!eng) {
      alert('영문 주소를 찾을 수 없습니다.');
      return;
    }

    const parsed = parseEnglish(eng.roadAddr, eng.zipNo);
    addr.dosi  = parsed.dosi;
    addr.city  = parsed.city;
    addr.line1 = parsed.line1;
    addr.line2 = '';
    addr.postal = parsed.postal;

    updatePreview();

    // 상세주소 입력 활성화
    detailInput.value = '';
    detailSection.classList.remove('hidden');
    detailSection.classList.add('fade-up');

    // 결과 목록 숨기기
    resultsList.classList.add('hidden');

    // 모바일: 폼 미리보기로 스크롤
    if (window.innerWidth <= 800) {
      setTimeout(() => {
        document.querySelector('.col-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  } catch {
    alert('영문 주소 변환에 실패했습니다.');
  }
}

// ── 상세주소 실시간 변환 ──────────────────────
detailInput.addEventListener('input', () => {
  addr.line2 = convertDetail(detailInput.value);
  updatePreview();
});

// ── 개별 필드 복사 ────────────────────────────
document.querySelectorAll('.pf-copy').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const key = btn.dataset.copy;
    const val = addr[key];
    if (!val) return;

    navigator.clipboard.writeText(val).then(() => {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1200);
      showToast();
    });
  });
});

// ── 전체 복사 ─────────────────────────────────
copyAllBtn.addEventListener('click', () => {
  if (!addr.line1) return;

  const lines = [addr.line1];
  if (addr.line2) lines.push(addr.line2);
  lines.push(`${addr.city}, ${addr.dosi} ${addr.postal}`);
  lines.push(addr.country);

  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    copyAllBtn.classList.add('copied');
    setTimeout(() => copyAllBtn.classList.remove('copied'), 1500);
    showToast('전체 주소가 복사되었습니다');
  });
});

// ── Toast ─────────────────────────────────────
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg || '복사되었습니다';
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 1800);
}
