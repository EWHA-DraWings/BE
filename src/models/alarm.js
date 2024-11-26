const mongoose = require('mongoose');

// 알림(Push) 스키마 정의
const AlarmSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },  // 사용자 ID, User 모델 참조
  hour: { 
    type: Number, 
    required: true 
  },  // 알림 설정 시간 (시)
  minute: { 
    type: Number, 
    required: true 
  },  // 알림 설정 시간 (분)
  deviceTokens: [{
    type: String, 
    unique: true, 
    required: true 
  }],  // FCM 기기 토큰 배열
}, {
  timestamps: true  // 생성 시간과 수정 시간을 자동으로 기록
});

const Alarm = mongoose.model('Alarm', AlarmSchema);

module.exports = Alarm;
