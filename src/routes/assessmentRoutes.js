// 0908ver(미들웨어 추가)
const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');
const { protect } = require('../middleware/authMiddleware'); // JWT 검증 미들웨어

// 자가진단 결과 생성
router.post('/', protect, assessmentController.createAssessment);

// 특정 사용자의 자가진단 결과 조회 (KDSQ 또는 PRMQ)
//router.get('/user/:questionnaireType', protect, assessmentController.getAssessmentsByUser);
router.get('/user', protect, assessmentController.getAssessmentsByUser);

// 특정 날짜의 자가진단 결과 조회
router.get('/:date', protect, assessmentController.getAssessmentsByDate);

// 특정 자가진단 결과 삭제(id: 자가진단 결과의 고유 식별자)
//router.delete('/:id', protect, assessmentController.deleteAssessment);

module.exports = router;




