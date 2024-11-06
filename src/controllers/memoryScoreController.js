// 1029 ver - 프론트로 보내는 데이터 수정
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

// WebSocket 서버 시작 함수
function startWebSocketServer(server) {
  const wssMemory = new WebSocket.Server({ noServer: true });

  wssMemory.on('connection', (ws) => {
    console.log('클라이언트가 WebSocket에 연결되었습니다.');
    let isAuthenticated = false; // 인증 여부 확인
    let userId = null; // 사용자 ID 저장

    // WebSocket 메시지 수신 시 처리
    ws.on('message', async (message) => {
      const receivedMessage = message.toString(); // Buffer를 문자열로 변환
      console.log('서버가 받은 메시지:', receivedMessage);
      
      try {
        // 인증되지 않은 상태에서 JWT 토큰 인증 처리
        if (!isAuthenticated && typeof receivedMessage === 'string') {
          const parsedMessage = JSON.parse(receivedMessage); // JSON 파싱
          console.log('파싱된 메시지:', parsedMessage);
          console.log('받은 토큰:', parsedMessage.token);

          if (parsedMessage.type === 'auth') { // 'auth' 타입일 경우 JWT 토큰 검증
            let token = parsedMessage.token;
            if (token && token.startsWith('Bearer ')) {
              token = token.split(' ')[1];
              console.log("최종 토큰 값:", token);
            }

            // JWT 검증
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
              if (err) {
                console.log("Invalid token:", err); // JWT 검증 실패 로그
                ws.send(JSON.stringify({ error: 'Invalid token' }));
                ws.close(); // 인증 실패 시 연결 종료
              } else {
                console.log("Token verified successfully:", decoded);
                isAuthenticated = true;
                userId = decoded.id; // 인증 성공 후 사용자 ID 설정
                ws.send(JSON.stringify({ message: 'Authenticated' })); // 인증 성공 응답

                // 첫 인사말 전송
                const greetingMessage = "안녕하세요! 소담이에요, 이제 기억 점수 측정을 시작해볼까요?";
                userConversations[userId] = [{ role: 'assistant', content: greetingMessage }];
                ws.send(JSON.stringify({
                  type: 'message',
                  conversations: userConversations[userId],
                  messageFromChatGPT: greetingMessage
                }));

                // TTS 변환 후 음성 데이터 전송
                textToSpeechConvert(greetingMessage).then(ttsResponse => {
                  if (ttsResponse && Buffer.isBuffer(ttsResponse)) {
                    ws.send(ttsResponse);
                  } else {
                    console.error("TTS 변환 실패:", ttsResponse);
                    ws.send(JSON.stringify({ error: 'TTS 변환에 실패했습니다.' }));
                  }
                });
              }
            });
          }
        } else if (isAuthenticated && Buffer.isBuffer(message)) { // 인증된 상태에서 음성 데이터 수신 시
          console.log("음성 데이터 수신");

          if (!userId) { // 사용자 ID가 없을 경우 오류 전송
            console.log("userId가 설정되지 않았습니다.");
            ws.send(JSON.stringify({ error: '사용자를 찾을 수 없습니다.' }));
            return;
          }

          // 사용자 조회
          const user = await ElderlyUser.findById(userId);
          if (!user) { // 사용자 없을 경우 오류 전송
            console.log("userId로 ElderlyUser를 찾지 못했습니다. userId:", userId);
            ws.send(JSON.stringify({ error: '사용자를 찾을 수 없습니다.' }));
            return;
          }

          // 보호자 정보 조회
          const guardian = await GuardianUser.findOne({ phone: user.guardianPhone });
          if (!guardian) {
            ws.send(JSON.stringify({ error: '보호자를 찾을 수 없습니다.' }));
            return;
          }

          // 사용자 정보 생성
          const userInfo = {
            elderlyName: user.name,
            guardianPhone: guardian.phone,
            address: guardian.address,
            birth: guardian.birth,
            job: guardian.job,
          };

          // 대화 기록이 없으면 초기화
          if (!userConversations[userId]) {
            userConversations[userId] = [];
          }
          let conversations = userConversations[userId];

          // 음성 데이터를 텍스트로 변환 (STT) 후 전송
          const userTextFromAudio = await speechToText(message);
          if (userTextFromAudio.trim().length > 0) {
            conversations.push({ role: 'user', content: userTextFromAudio });

            // 사용자 텍스트 먼저 전송
            ws.send(
              JSON.stringify({
                type: "response",
                userText: userTextFromAudio,
                sessionId: ws.sessionId,
              })
            );
          }

          // 최근 3일간의 일기 조회 및 최소 2개 일기 확인
          const diaryList = [];
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          for (let i = 3; i > 0; i--) {
            let targetDate = new Date(today);
            targetDate.setDate(today.getDate() - i);

            const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

            const diary = await Diary.findOne({ userId: user._id, date: { $gte: startOfDay, $lte: endOfDay } });
            if (diary) diaryList.push(diary);
          }

          if (diaryList.length < 2) { // 일기 개수가 부족할 경우 오류 전송
            ws.send(JSON.stringify({ error: '기억 점수를 측정하려면 최소 2개의 일기가 필요합니다.' }));
            return;
          }

          // 기억 테스트 진행 및 GPT 응답 생성
          const response = await memoryTest(userInfo, diaryList, conversations);
          const responseText = response.content.trim();
          if (responseText.length > 0) {
            conversations.push({ role: 'assistant', content: responseText });

            // GPT 응답 텍스트 전송
            ws.send(
              JSON.stringify({
                type: "response",
                gptText: responseText,
                sessionId: ws.sessionId,
                audioSize: audioContent ? audioContent.length : null, // 음성 데이터 크기 추가
              })
            );

            // TTS 음성 데이터 전송
            const ttsResponse = await textToSpeechConvert(responseText);
            if (ttsResponse && Buffer.isBuffer(ttsResponse)) {
              ws.send(ttsResponse);
            } else {
              console.error("TTS 변환에 실패했거나 Buffer가 아닙니다. 응답:", ttsResponse);
              ws.send(JSON.stringify({ error: 'TTS 변환에 실패했습니다.' }));
            }
          }

          // 대화 내역 검증
          const isValidConversations = conversations.every(conv => conv.content && conv.content.trim().length > 0);
          if (!isValidConversations) {
            console.error("대화 내역에 유효하지 않은 항목이 있습니다.");
            ws.send(JSON.stringify({ error: '대화 내용에 오류가 있습니다.' }));
            return;
          }

          // 테스트 완료 시 결과 전송
          if (response.isTestCompleted || response.content.includes('결과를 알려드릴게요')) {
            const questionCnt = parseInt(response.content.match(/전체 질문 개수: (\d+)/)[1]);
            const correctCnt = parseInt(response.content.match(/정답 개수: (\d+)/)[1]);
            const hintCnt = parseInt(response.content.match(/사용된 힌트 개수: (\d+)/)[1]);

            const diaryIds = diaryList.map(diary => diary._id);
            const { correctRatio, score: cdrScore } = calculateCdrScore(questionCnt, correctCnt, hintCnt);

            // conversations에서 빈 content가 있는 대화 제거 후 저장
            const filteredConversations = conversations.filter(conv => conv.content && conv.content.trim() !== '');

            const memoryScore = new MemoryScore({
              userId: user._id,
              diaryIds,
              questionCnt,
              hintCnt,
              correctCnt,
              correctRatio,
              cdrScore,
              conversations: filteredConversations
            });

            try {
              await memoryScore.save();
              console.log('MemoryScore saved successfully:', memoryScore);
            } catch (error) {
              console.error('Failed to save MemoryScore:', error);
              ws.send(JSON.stringify({ error: '기억 점수 저장 중 오류가 발생했습니다.' }));
              return;
            }

            // 추천 메시지 생성 및 결과 전송
            const recommendationMessage = cdrScore == 0.5 || cdrScore == 1
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
        console.error('기억 테스트 중 오류 발생:', error);
        ws.send(JSON.stringify({ error: '기억 테스트 중 오류가 발생했습니다.' }));
      }
    });

    // WebSocket 연결이 닫힐 때 처리
    ws.on('close', () => {
      console.log('WebSocket connection closed.');
    });
  });

  return wssMemory;
}

// WebSocket 서버를 시작하는 함수를 내보내기
module.exports = { startWebSocketServer };
