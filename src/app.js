const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const ttsRoutes = require('./routes/ttsRoutes');
const sttRoutes = require('./routes/sttRoutes');
const diaryRoutes = require('./routes/diaryRoutes');
const emotionAnalysisRoutes = require('./routes/emotionAnalysisRoutes');
const memoryScoreRoutes = require('./routes/memoryScoreRoutes');
const reportRoutes = require('./routes/reportRoutes');
//const alarmRoutes = require('./routes/alarmRoutes'); // 알람 라우터 가져오기

// 일기 생성 챗봇과 기억 점수 측정 챗봇 컨트롤러
const { handleWebSocketMessage } = require('./controllers/chatController');
const { startWebSocketServer } = require('./controllers/memoryScoreController');

const app = express();

// MongoDB 연결
connectDB();

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// message.html 실행 테스트
app.use(express.static("public"));

// 라우터 설정
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/stt', sttRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/emotion-analysis', emotionAnalysisRoutes);
app.use('/api/findmemoryscore', memoryScoreRoutes);
app.use('/api/reports', reportRoutes);
//app.use('/api/alarms', alarmRoutes);

// HTTP 서버 생성
const server = http.createServer(app);

// WebSocket 서버 생성
const wssDiary = new WebSocket.Server({ noServer: true });
const wssMemory = startWebSocketServer(server);  // 반환된 memoryWss 객체(controller에서 반환)

// WebSocket 연결을 위한 업그레이드 처리
// 일기 생성용, 기억점수 측정용 경로 분리
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (pathname === '/ws/diary') {
    wssDiary.handleUpgrade(req, socket, head, (ws) => {
      wssDiary.emit('connection', ws, req);
    });
  } else if (pathname === '/ws/memory') {
    wssMemory.handleUpgrade(req, socket, head, (ws) => {
      wssMemory.emit('connection', ws, req);
    });
  } else {
    socket.destroy();  // 그 외 경로는 버려
  }
});

// 일기 생성 WebSocket 서버 연결 설정
wssDiary.on('connection', (ws) => {
  console.log('일기 생성 WebSocket 연결 성공');
  ws.on('message', (message) => handleWebSocketMessage(ws, message));
  ws.on('close', () => console.log('일기 생성 WebSocket 연결 종료'));
});

// 서버 실행
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});

module.exports = app;