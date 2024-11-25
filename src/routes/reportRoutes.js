// 1003 ver - 3일치 리포트 가져오도록 수정
const express = require('express');
const { getOrCreateReport, getReportsForLastDays } = require('../controllers/reportController');
//const {getReportsForLastDays } = require('../controllers/reportController');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // JWT 검증 미들웨어

// 날짜 형식 검증 미들웨어 (YYYY-MM-DD 형식 체크)
const validateDate = (req, res, next) => {
    const { date } = req.params;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!date || !date.match(dateRegex)) {
        return res.status(400).json({ message: '유효하지 않은 날짜 형식입니다. YYYY-MM-DD 형식이어야 합니다.' });
    }

    next();
};

// POST 요청에서 리포트가 없으면 생성, 있으면 조회
router.post('/:date', protect, validateDate, getOrCreateReport);

// 최근 3일간의 리포트 조회 및 자동 생성 (오늘 포함 4일 조회)
router.get('/', protect, getReportsForLastDays);

// 특정 날짜에 대한 리포트 조회
//router.get('/:date', protect, validateDate, getReportsByDate);

module.exports = router;
