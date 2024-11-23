// 1008 ver - 정답률, 전체 질문 개수, 정답 개수, 힌트 사용 개수 추가
const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ElderlyUser',
    required: true
  },
  diaryId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Diary',
    required: true
  },
  date: { 
    type: Date,
    required: true
  },
  cdrScore: { // 기억 점수
    type: Number,
    ref: 'MemoryScore',
    required: false
  },
  memoryScoreId: { // MemoryScore의 _id 저장
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemoryScore',
    required: false
  },
  correctRatio: { // 정답 비율
    type: Number,
    ref: 'MemoryScore',
    set: (value) => Math.round(value * 100) / 100,
    required: false
  },
  questionCnt: { // 전체 질문 수
    type: Number,
    ref: 'MemoryScore',
    required: false
  },
  correctCnt: { // 정답 개수
    type: Number,
    ref: 'MemoryScore',
    required: false
  },
  hintCnt: { // 사용된 힌트 개수
    type: Number,
    ref: 'MemoryScore',
    required: false
  },
  emotions: {
    type: Map,
    of: Number, // 감정 분석 결과
    required: true
  },
  conditions: { 
    type: String, // 건강 상태
    required: true
  },
});

const Report = mongoose.model('Report', ReportSchema);
module.exports = Report;
