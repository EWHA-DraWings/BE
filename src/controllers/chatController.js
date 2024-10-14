const { generateDiary } = require("../utils/chatgpt");
const { speechToText } = require("../utils/stt");
const { textToSpeechConvert } = require("../utils/tts");
const Diary = require("../models/Diary"); //
const ElderlyUser = require("../models/ElderlyUser");
const ChatSession = require("../models/ChatSession");
const { v4: uuidv4 } = require("uuid");
require('dotenv').config();
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

// 오늘의 일기가 이미 생성되었는지 확인하는 함수
async function checkDiaryExistsForToday(userId) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  const startDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const endDate = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

  const existingDiary = await Diary.findOne({
    userId: userId,
    date: { $gte: startDate, $lte: endDate }
  });

  return existingDiary ? true : false;
}

// 소담이 먼저 말 걸어줌
async function initMessage(ws, token, sessionId) {
  const userId = getUserFromToken(token);

  // 오늘의 일기가 이미 생성되었는지 확인
  const diaryExists = await checkDiaryExistsForToday(userId);
  if (diaryExists) {
    const diaryExistsMsg = '오늘의 일기는 이미 생성되었어요. 내일 또 대화 나눠요!';
    let audioContent = await textToSpeechConvert(diaryExistsMsg);

    // JSON 응답 전송
    ws.send(
      JSON.stringify({
        type: "response",
        userText: '...',
        gptText: diaryExistsMsg,
        sessionId: sessionId,
      })
    );

    // 음성 데이터 전송
    if (audioContent) {
      ws.send(audioContent);
    }
    return;
  }

  // 대화 세션 찾기
  let chatSession = await ChatSession.findOne({
    userId: userId,
    sessionId: sessionId,
  });

  // 기본 시작 멘트
  let introMsg = '안녕하세요! 저는 소담이에요! 오늘 어떤 하루를 보내셨나요?';

  // 중단 후 재시작 멘트
  if (chatSession) {
    let recentMsg = '';
    if (chatSession.messages.length % 2 == 0) {
      recentMsg = chatSession.messages[chatSession.messages.length - 1].content;
    }
    introMsg = '다시 돌아오셨군요! 이어서 대화를 시작해봐요!' + recentMsg;
    console.log(introMsg);
  }

  let audioContent = await textToSpeechConvert(introMsg);

  // JSON 응답 전송
  ws.send(
    JSON.stringify({
      type: "response",
      userText: '...', // 사용자 입력 대신 챗봇의 첫 인사로 시작
      gptText: introMsg,
      sessionId: sessionId,
    })
  );

  // 음성 데이터 전송
  if (audioContent) {
    ws.send(audioContent);
  }
}

// token으로 user 찾기
function getUserFromToken(token) {
  const secretKey = process.env.JWT_SECRET;
  try {
    const decoded = jwt.verify(token, secretKey);
    return decoded.id;
  } catch (err) {
    console.error('토큰 검증 실패', err);
    return null;
  }
}

exports.handleWebSocketMessage = async (ws, message) => {
  try {
    if (message.toString().startsWith("{")) {
      const data = JSON.parse(message);
      console.log(data);
      const { token, sessionId } = data;

      const userId = getUserFromToken(token);
      ws.userId = userId;
      ws.sessionId = sessionId || ws.sessionId || uuidv4();

      const user = await ElderlyUser.findById(userId);
      if (!user) {
        ws.send(JSON.stringify({ type: "error", message: "사용자를 찾을 수 없습니다." }));
        return;
      }

      const today = new Date().toISOString();
      const year = today.substring(0, 4);
      const month = today.substring(5, 7);
      const day = today.substring(8, 10);

      const startDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      const endDate = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

      const existingSession = await ChatSession.findOne({
        userId,
        createdAt: { $gte: startDate, $lte: endDate }
      });

      if (existingSession) {
        ws.sessionId = existingSession.sessionId;
      }

      if (data.type == "startConversation") {
        await initMessage(ws, token, ws.sessionId);
        return;
      }

      if (data.type == "endConversation") {
        await handleEndConversation(ws, userId);
        return;
      }

    } else if (Buffer.isBuffer(message)) {
      const { userId, sessionId } = ws;
      if (!userId) {
        ws.send(JSON.stringify({ type: "error", message: "사용자 ID가 설정되지 않았습니다." }));
        return;
      }

      const audioBuffer = message;
      const userText = await speechToText(audioBuffer);
      console.log('Converted user text:', userText);

      if (userText.trim() === '') {
        ws.send(JSON.stringify({ type: "error", message: "인식된 텍스트가 비어 있습니다." }));
        return;
      }

      let chatSession = await ChatSession.findOne({ userId: userId, sessionId: sessionId });
      if (!chatSession) {
        chatSession = new ChatSession({ userId: userId, sessionId: sessionId, messages: [] });
      }

      chatSession.messages.push({
        role: "user",
        content: userText,
        timestamp: new Date(),
      });

      const conversations = chatSession.messages;
      const gptResponse = await generateDiary(conversations, userId);

      let audioContent;
      if (gptResponse) {
        audioContent = await textToSpeechConvert(gptResponse);
      }

      await chatSession.save();

      // 사용자 텍스트 먼저 전송
      ws.send(
        JSON.stringify({
          type: "response",
          userText, // 사용자 텍스트만 먼저 전송
          sessionId,
        })
      );

      // GPT 응답 생성 후, GPT 텍스트 및 음성 데이터 전송
      if (gptResponse) {
        // GPT 응답 전송
        ws.send(
          JSON.stringify({
            type: "response",
            gptText: gptResponse, // GPT 응답 따로 전송
            sessionId,
            audioSize: audioContent ? audioContent.length : null, // 음성 데이터 크기 추가
          })
        );

        // TTS 음성 데이터 전송
        if (audioContent) {
          ws.send(audioContent); 
        }
      }
    }
  } catch (error) {
    console.error("에러 발생:", error);
    ws.send(JSON.stringify({ type: "error", message: "처리 실패: " + error.message }));
  }
};

async function handleEndConversation(ws, userId) {
  try {
    console.log(`Ending conversation for user: ${userId}`);
    ws.send(JSON.stringify({ type: "info", message: "대화가 종료되었습니다." }));
  } catch (error) {
    console.error("Error ending conversation:", error);
    ws.send(JSON.stringify({ type: "error", message: "대화 종료 실패: " + error.message }));
  }
}
