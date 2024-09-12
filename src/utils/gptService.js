// 0910ver - 질문개수 최소 7, 최대 20개로 + 자녀에게 하고 싶은 말 삭제
require('dotenv').config();
const { OpenAI } = require("openai");
const ChatSession = require('../models/ChatSession');
const Diary = require('../models/Diary');

// 프롬프트 설정
const prompt = `
<Your role> 
A helpful assistant that assists elderly users by regularly engaging them in conversations, recording their daily activities, and monitoring their health. 
</Your role> 
<Requirements> 
You should ask about his or her daily life naturally so that the user feels as if they are just chatting with you. Ask one question at a time, and make sure to ask between 7 and 20 questions, depending on the flow of the conversation. If it feels like enough dialogue has taken place, you can conclude the conversation. Also, indirectly ask questions to determine the user’s health status and record this as 'health status' in a diary.
</Requirements> 
<Style> 
Continue the conversation by giving empathy and advice in a friendly way. The other person is an elderly individual, so speak in an easy-to-understand and respectful manner. The diary should be written in accordance with the user's tone of voice and in casual language, but sentences should end with the format "~다" to maintain a proper diary style.
</Style> 
<Output> 
You should create 2 sections for the output.
Section 1: Complete a diary in Korean by summarizing the user's answers to the daily life questions you asked, including details of any conversations the user had with other people. The title should be '오늘의 일기.' Please write the diary in detail based on the conversation, and ensure that all sentences end with "~다."
Section 2: Record health status obtained through the questionnaire. The title should be '건강 상태.' This should not overlap with Section 1.
</Output>`;

// GPT-4o 호출 함수
async function callChatgpt(conversations) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: conversations,
    });

    // gpt 응답 내용을 assistant로 저장
    conversations.push({
      role: "assistant",
      content: response.choices[0].message.content,
    });

    return response.choices[0].message.content;

  } catch (error) {
    console.error('Chatgpt API를 불러오는 과정에서 에러 발생', error);
    return null;
  }
}

// 일기 생성 함수
async function generateDiary(conversations) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let messages = [{ role: "system", content: prompt }];
  messages = messages.concat(conversations);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
    });

    const fullResponse = response.choices[0].message.content;

    // 파싱 로직
    const diary = extractSection(fullResponse, '오늘의 일기');
    const healthStatus = extractSection(fullResponse, '건강 상태');

    return { diary, healthStatus };

  } catch (error) {
    console.error('Chatgpt API를 불러오는 과정에서 에러 발생', error);
    return null;
  }
}

// 일기, 컨디션  하고 싶은 말 파싱
function extractSection(text, title) {
  const regex = new RegExp(`${title}\\s*([\\s\\S]*?)(?=\\n\\w+:|$)`, 'g');
  const match = regex.exec(text);
  return match ? match[1].trim() : null;
}

module.exports = { callChatgpt, generateDiary };
