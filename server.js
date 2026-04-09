const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const JUSO_API_KEY = process.env.JUSO_API_KEY;

// 한글 주소 검색 프록시
app.get('/api/search', async (req, res) => {
  const { keyword, page = 1 } = req.query;
  if (!keyword) return res.status(400).json({ error: '검색어를 입력하세요' });
  if (!JUSO_API_KEY) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다' });

  try {
    const url = `https://business.juso.go.kr/addrlink/addrLinkApi.do?confmKey=${JUSO_API_KEY}&currentPage=${page}&countPerPage=10&keyword=${encodeURIComponent(keyword)}&resultType=json`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: '주소 검색에 실패했습니다' });
  }
});

// 영문 주소 검색 프록시
app.get('/api/english', async (req, res) => {
  const { keyword, page = 1 } = req.query;
  if (!keyword) return res.status(400).json({ error: '검색어를 입력하세요' });
  if (!JUSO_API_KEY) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다' });

  try {
    const url = `https://business.juso.go.kr/addrlink/addrEngApi.do?confmKey=${JUSO_API_KEY}&currentPage=${page}&countPerPage=10&keyword=${encodeURIComponent(keyword)}&resultType=json`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: '영문 주소 변환에 실패했습니다' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행: http://localhost:${PORT}`);
});
