// 1004ver - 프롬프트 수정
require('dotenv').config();
const { OpenAI } = require("openai");

// 기억점수 프롬프트 생성 함수
async function createScorePrompt(userInfo, diaryList) {
  let score_prompt = `
<Your role>
당신은 사용자의 일기를 바탕으로 '기억 점수'를 측정하는 챗봇입니다. 질문은 반드시 하나씩만 제공하고, 사용자의 응답을 받은 후에만 다음 질문을 제공해야 합니다. 질문은 구체적이어야 하며, 동일하거나 비슷한 질문은 반복하지 않습니다. 사용자가 질문에 답하지 못하거나 틀린 답을 했을 때만 힌트를 하나씩 제공합니다.

<Requirements>
1. 각 질문은 반드시 한 번에 하나씩만 제공하세요.
2. 사용자의 응답을 받은 후에만 다음 질문을 제공하세요.
3. 동일하거나 비슷한 질문을 반복하지 마세요.
4. 사용자가 질문에 제대로 답변하지 못했을 때만 힌트를 하나씩 제공합니다. 한 문제당 힌트는 최대 3개입니다. 힌트에는 답이 포함되면 안됩니다.`;

  // 일기 개수에 따른 질문 설정
  if (diaryList.length === 3) {
    score_prompt += `
5. 3일 전, 2일 전, 1일 전의 일기 내용을 바탕으로 순서대로 질문을 생성하세요.
6. 질문1: 3일 전의 일기를 바탕으로 최근 발생한 일을 기억하는지 묻는 질문.
7. 질문2: 2일 전의 일기를 바탕으로 기억을 묻는 질문.
8. 질문3: 1일 전의 일기를 바탕으로 기억을 묻는 질문.
9. 질문4: 최근 3일간의 일기에서 대화 관련 내용을 상기시키는 질문 (대화가 없을 경우 생략).
10. 질문5: 충분한 응답이 없거나 오답률이 20% 초과일 경우 추가 질문.
`;
  } else if (diaryList.length === 2) {
    score_prompt += `
5. 2개의 일기 내용을 바탕으로 질문을 생성하세요.
6. 질문1: 2개의 일기 중 가장 오래된 일기를 바탕으로 기억을 묻는 질문.
7. 질문2: 2개의 일기 중 가장 최신의 일기를 바탕으로 기억을 묻는 질문.
7. 질문3: 질문1, 2와는 다른 일기를 바탕으로 기억을 묻는 질문.
8. 질문4: 2개의 일기 중에서 대화 관련 내용을 상기시키는 질문 (대화가 없을 경우 생략).
9. 질문5: 충분한 응답이 없거나 오답률이 20% 초과일 경우 추가 질문.
`;
  }

  score_prompt += `
<추가질문>
1. 오늘 날짜를 알고 있는가 - 오늘 날짜를 정확히 맞춰야 정답입니다. 답을 맞추지 못한 경우에도 힌트 없이 바로 2번 질문으로 넘어갑니다.
2. 가족이나 친구의 직업, 생일, 주소를 기억하고 있는가? 가지고 있는 'user information' 중에서 하나를 골라 질문합니다.

모든 질문에 대한 정답 여부는 사용자에게 밝히지 않으며, 마지막에 점수를 측정해 결과를 제공합니다. 사용자의 응답이 일기와 정확하게 일치하지 않더라도, 유사한 내용을 기억하고 있다면 정답으로 인정합니다. 추가 질문을 제외한 질문에서의 오답률이 20%를 초과하면 추가 질문을 합니다.

<출력>
각 질문에 대한 응답을 받은 후에만 다음 질문을 제공하세요. 
결과는 전체 질문 개수, 사용된 힌트 개수, 정답 개수, 정답률, CDR 기억점수로 구분해 출력하세요. CDR 기억점수는 0, 0.5, 1 중 하나입니다.
'결과를 알려드릴게요'라고 말한 후, 결과를 출력하세요.
CDR 기억점수가 0.5이거나 1인 경우 자가진단을 제안하고, CDR 기억점수가 0인 경우에는 '축하합니다! 기억력이 매우 좋으시네요.' 를 출력하세요.

<사용자 정보>
보호자 주소: ${userInfo.address}, 보호자 생일: ${userInfo.birth}, 보호자 직업: ${userInfo.job}, 사용자 이름: ${userInfo.elderlyName}

<일기 내용>`;

  diaryList.forEach(diary => {
    score_prompt += `\n- 일기 날짜: ${diary.date}, 일기 내용: ${diary.content}`;
  });

  return score_prompt;
}


// 기억 테스트 함수
async function memoryTest(userInfo, diaryList, conversations) {
  const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 10000, // 타임아웃 설정
  });

  const score_prompt = await createScorePrompt(userInfo, diaryList);

  let messages = [{ role: "system", content: score_prompt }];
  messages = messages.concat(conversations);

  try {
      const response = await openai.chat.completions.create({
          model: "gpt-4o", 
          messages: messages,
          temperature: 0.7,  // Playground 기본값
          max_tokens: 512,  
          top_p: 1.0,  // Playground 기본값
          frequency_penalty: 0,  // Playground 기본값
          presence_penalty: 0,  // Playground 기본값
      });

      console.log("OpenAI Response: ", JSON.stringify(response, null, 2));
      //console.log("OpenAI Response Message: ", response.choices[0].message);


      // 응답 데이터 추출
      if (response.choices && response.choices[0] && response.choices[0].message) {
          const messageContent = response.choices[0].message.content;
          return { content: messageContent }; // JSON 구조로 반환

      } else {
          console.error('Unexpected API response structure:', JSON.stringify(response, null, 2));
          return { error: 'Unexpected API response structure' };
      }

  } catch (error) {
      console.error('ChatGPT API 호출 중 오류 발생:', error);
      throw new Error('ChatGPT API 응답을 받지 못했습니다.');
  }
}

// CDR 점수 계산 함수
function calculateCdrScore(questionCnt, correctCnt, hintCnt) {
  let score = 0; // 기본값은 0 (가장 좋은 점수)

  const correctRatio = correctCnt / questionCnt;

  console.log("Correct Ratio:", correctRatio);
  
  // 정답 비율에 따른 점수 계산
  if (correctRatio >= 0.8) {
      score = 0;  // 80% 이상 정답인 경우
  } else if (correctRatio >= 0.7) {
      score = 0.5;  // 70% ~ 79% 정답인 경우
  } else {
    score = 1; // 70% 미만 정답인 경우
  }

  // 힌트 사용이 4개 이상인 경우 최소 점수는 0.5
  if (hintCnt >= 4) {
      score = Math.min(score, 0.5);  // 최소 0.5 보장
  }

  console.log("Calculated CDR Score:", score); // 로그로 확인
  return { correctRatio, score };
}


module.exports = { memoryTest, createScorePrompt, calculateCdrScore };
