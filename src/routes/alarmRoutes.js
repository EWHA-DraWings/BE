const express = require('express');
const { sendPushNotice, updateAlarmTime } = require('../controllers/pushController');
const { protect } = require('../middleware/authMiddleware');  // JWT 인증 미들웨어
const router = express.Router();

// 알림 전송 라우트 
router.post('/send-push-notice', protect, sendPushNotice); 
// 알림 시간 수정
router.put('/update-time', protect, updateAlarmTime);

module.exports = router;
