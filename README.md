# 캡스톤디자인 그로쓰 05팀 그린나래 BE 레포

### 😄Members
- 프로젝트 기간: 24.03~24.12
- 김여은: FE(리더), BE
- 우정아: BE(리더), AI
- 장서연: AI(리더), FE
<br><br>

## 📂프로젝트 소개
✔️ 서비스명: 소담 - 소리로 담는 나만의 작은 이야기

✔️ 주제: 노인 인지 기능 저하 예방을 위한 GPT-4o 기반 음성 챗봇 및 일기 생성 서비스

✔️ 부제: 대화로 기억을 지키는 치매 예방 솔루션

<br><br>

## 📂기능 소개
✔️ 기능1: AI와의 음성 채팅<br>
: 사용자가 설정한 시간에(ex. 저녁 7시) 규칙적으로 하루에 있었던 일, 수면 시간, 섭취 음식, 약 복용 여부 등 여러 질문들을 챗봇이 음성으로 제공

✔️ 기능2: 일기 생성<br>
: 챗봇과 나눈 대화를 바탕으로 요약된 일기 생성

✔️ 기능3: report 제공<br>
: 챗봇과 나눈 대화를 바탕으로 report 제공.<br>
: 리포트에는 감정 분석 결과, 컨디션, 기억점수 그래프가 포함<br>

✔️ 기능4: 기억점수 측정 및 치매 자가진단<br>
: 챗봇과의 음성 대화를 통해 3일간의 일기 데이터를 바탕으로 기억점수 측정<br>
: TTS 기능을 활용한 자가진단(KDSQ, PRMQ)을 통해 추가적인 인지기능 저하 체크<br>


노인 사용자/ 보호자 사용자의 기능 비교<br>

![image](https://github.com/user-attachments/assets/040638f8-0479-4595-9aad-38cc014b6a94)

<br><br>

## 💻BE 사용 기술 및 프레임워크
- gpt-4o: https://openai.com/index/hello-gpt-4o/
- Google cloud Text-to-Speech: https://cloud.google.com/text-to-speech?hl=ko
- Naver CLOVA Speech Recognition: https://www.ncloud.com/product/aiService/csr
- node.js
<br><br>

## Source 코드 설명
- ```userController```: 보호자 사용자, 노인 사용자 회원가입 담당 코드 & 아이디 중복 확인 & 비밀번호 해싱
- ```authController```: 보호자 사용자, 노인 사용자 로그인 담당 코드 & JWT 토큰 활용
- ```chatController```: 일기 생성을 위한 챗봇과의 음성 대화 진행
  - ```utils/gptService```: 일기 생성을 위한 프롬프트 설정 및 gpt-4o 호출
  - ```utils/stt```: 사용자 음성을 텍스트로 변환하는 역할
  - ```utils/tts```: gpt 응답을 음성으로 변환하는 역할
- ```memoryScoreController```: db에 저장되어 있는 과거 3일치 일기를 기반으로 기억점수 측정 진행(ex. 오늘이 17일이라면 14, 15, 16일 일기로)
  - ```utils/memoryScoreService```: 기억점수 측정을 위한 프롬프트 설정 및 gpt-4o 호출
  - ```utils/stt```: 사용자 음성을 텍스트로 변환하는 역할
  - ```utils/tts```: gpt 응답을 음성으로 변환하는 역할
- ```reportController```: 플라스크 서버로 감정 분석 요청 & 감정 분석 결과, 기억점수 결과, 자가진단 결과 생성 및 조회

<br><br>

## 🔨How to build
1. Ubuntu 서버 접속
AWS에서 EC2 인스턴스를 생성한 후, 아래 명령어를 통해 서버에 접속하기

```
ssh -i /path/to/your-key.pem ubuntu@your-ec2-public-ip
```

2. Node.js 및 npm 설치
   
```
sudo apt update
sudo apt install -y nodejs npm  
```

3. 소스 코드 클론
프로젝트 소스 코드를 clone해오기
```
git clone https://github.com/EWHA-DraWings/BE.git
git pull origin main # 최신 코드 pull
```

4. app 실행
```
npm install -g pm2
pm2 start src/app.js
```

<br><br>
## 🛠️How to install🛠
1. 키 발급받기
- Google cloud Text-to-Speech Key
- Naver CLOVA Speech Recognition Key
- OpenAI API Key

2. DB 연결
- MongoDB Atals 활용(https://www.mongodb.com/products/platform/atlas-database에서 클러스터 생성 해주기)
- 아래 명령어로 필수 패키지 설치
```
npm install mongoose 
```
- 연결
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/myDatabase
```
   
4. 환경변수 설정
- .env 파일을 BE 폴더에 생성
- ```cat /home/ubuntu/Sodam/.env``` 로  .env 파일에 MONGODB_URI, Port 번호, JWT_SECRET, STT KEY, TTS KEY, OpenAI API KEY 작성

<br><br>
## 📜How to test
1. APK 테스트
   프론트엔드와 백엔드가 통합된 APK 테스트는 https://github.com/EWHA-DraWings/FE의 README를 참고해주세요.

2. 백엔드 테스트
   로컬 서버에서 실행한 후, API 명세서에 명시된 기능별 URL로 접속하여 예시 입력값으로 테스트를 진행합니다.
   - 테스트 계정: "id": "jonggang", "password": "20240929"
   - 음성 대화는 APK 테스트에서만 실행이 가능합니다. 백엔드 테스트를 통해서는 회원가입, 로그인, 리포트 조회, 일기 수정.조회 기능만 확인 가능합니다.
     -  ```회원가입```: /api/users/elderly/register
     - ```로그인```: /api/auth/login
     - ```특정 날짜 일기 조회```: /api/diary/date/:date (20240901형식)
     - ```일기 수정```: /api/diary/:diaryId(diaryId는 MongoDB ObjectId)
     - ```리포트 조회```: /api/reports
