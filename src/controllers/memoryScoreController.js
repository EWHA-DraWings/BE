const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { speechToText } = require("../utils/stt");
const { textToSpeechConvert } = require("../utils/tts");
const { memoryTest, calculateCdrScore } = require('../utils/memoryScoreService');
const ElderlyUser = require('../models/ElderlyUser');
const MemoryScore = require('../models/MemoryScore');
const Diary = require('../models/Diary');
const GuardianUser = require('../models/GuardianUser');

let userConversations = {}; // 사용자별 대화 관리 객체

function startWebSocketServer(server) {
  const wssMemory = new WebSocket.Server({ noServer: true });

  wssMemory.on('connection', (ws) => {
    console.log('클라이언트가 WebSocket에 연결되었습니다.');
    let isAuthenticated = false;
    let userId = null;

    ws.on('message', async (message) => {
      try {
        const receivedMessage = message.toString();
        console.log('서버가 받은 메시지:', receivedMessage);

        // JWT 인증 처리
        if (!isAuthenticated && typeof receivedMessage === 'string') {
          const parsedMessage = JSON.parse(receivedMessage);
          if (parsedMessage.type === 'auth') {
            let token = parsedMessage.token;
            if (token.startsWith('Bearer ')) {
              token = token.split(' ')[1];
            }

            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
              if (err) {
                console.error("Invalid token:", err);
                ws.send(JSON.stringify({ error: 'Invalid token' }));
                ws.close();
              } else {
                isAuthenticated = true;
                userId = decoded.id;

                ws.send(JSON.stringify({ message: 'Authenticated' }));

                // 대화 초기화
                if (!userConversations[userId]) {
                  userConversations[userId] = [];
                }

                const greetingMessage = "안녕하세요! 소담이에요, 이제 기억 점수 측정을 시작해볼까요?";
                userConversations[userId].push({ role: 'assistant', content: greetingMessage });

                ws.send(JSON.stringify({ type: 'message', messageFromChatGPT: greetingMessage }));

                // TTS 변환
                textToSpeechConvert(greetingMessage).then(ttsResponse => {
                  if (Buffer.isBuffer(ttsResponse)) {
                    ws.send(ttsResponse);
                  } else {
                    console.error("TTS 변환 실패:", ttsResponse);
                    ws.send(JSON.stringify({ error: 'TTS 변환에 실패했습니다.' }));
                  }
                });
              }
            });
            return;
          }
        }

        // 음성 데이터 처리
        if (isAuthenticated && Buffer.isBuffer(message)) {
          console.log("음성 데이터 수신");

          // 사용자 정보 확인
          const user = await ElderlyUser.findById(userId);
          if (!user) {
            ws.send(JSON.stringify({ error: '사용자를 찾을 수 없습니다.' }));
            return;
          }
          const guardian = await GuardianUser.findOne({ phone: user.guardianPhone });
          if (!guardian) {
            ws.send(JSON.stringify({ error: '보호자를 찾을 수 없습니다.' }));
            return;
          }

          const userInfo = {
            elderlyName: user.name,
            guardianPhone: guardian.phone,
            address: guardian.address,
            birth: guardian.birth,
            job: guardian.job,
          };

          // STT 변환
          const userTextFromAudio = await speechToText(message);
          if (userTextFromAudio.trim().length > 0) {
            userConversations[userId].push({ role: 'user', content: userTextFromAudio });
            ws.send(JSON.stringify({ type: 'response', userText: userTextFromAudio }));
          }

          // 최근 3일간의 일기 가져오기
          const diaryList = [];
          const today = new Date();
          for (let i = 3; i > 0; i--) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() - i);
            const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
            const diary = await Diary.findOne({ userId: user._id, date: { $gte: startOfDay, $lte: endOfDay } });
            if (diary) diaryList.push(diary);
          }

          if (diaryList.length < 2) {
            ws.send(JSON.stringify({ error: '기억 점수를 측정하려면 최소 2개의 일기가 필요합니다.' }));
            return;
          }

          // 기억 테스트 진행
          const response = await memoryTest(userInfo, diaryList, userConversations[userId]);
          const responseText = response.content.trim();
          userConversations[userId].push({ role: 'assistant', content: responseText });

          ws.send(JSON.stringify({ type: 'response', gptText: responseText }));

          // TTS 변환
          const ttsResponse = await textToSpeechConvert(responseText);
          if (Buffer.isBuffer(ttsResponse)) {
            ws.send(ttsResponse);
          } else {
            ws.send(JSON.stringify({ error: 'TTS 변환에 실패했습니다.' }));
          }

          // 테스트 완료 시 결과 저장
          if (response.isTestCompleted || response.content.includes('결과를 알려드릴게요')) {
            const questionCnt = parseInt(response.content.match(/전체 질문 개수: (\d+)/)[1]);
            const correctCnt = parseInt(response.content.match(/정답 개수: (\d+)/)[1]);
            const hintCnt = parseInt(response.content.match(/사용된 힌트 개수: (\d+)/)[1]);

            const { correctRatio, score: cdrScore } = calculateCdrScore(questionCnt, correctCnt, hintCnt);
            const memoryScore = new MemoryScore({
              userId: user._id,
              diaryIds: diaryList.map(diary => diary._id),
              questionCnt,
              hintCnt,
              correctCnt,
              correctRatio,
              cdrScore,
              conversations: userConversations[userId],
            });

            await memoryScore.save();
            const recommendationMessage = cdrScore >= 0.5
              ? "CDR 기억점수가 낮습니다. 자가진단을 추천드립니다."
              : "축하합니다! 좋은 기억력을 가지고 계시네요.";

            ws.send(JSON.stringify({
              message: '기억 테스트가 완료되었습니다.',
              cdrScore,
              correctRatio,
              questionCnt,
              hintCnt,
              correctCnt,
              recommendation: recommendationMessage,
              nextAction: '테스트가 종료되었습니다.'
            }));
          }
        }
      } catch (error) {
        console.error('오류 발생:', error);
        ws.send(JSON.stringify({ error: '오류가 발생했습니다.' }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed.');
      if (userId) delete userConversations[userId];
    });
  });

  return wssMemory;
}

module.exports = { startWebSocketServer };
