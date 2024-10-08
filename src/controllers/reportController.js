// 0916 ver - 감정분석+리포트 동시에
const asyncHandler = require('express-async-handler');
const axios = require('axios');
const Report = require('../models/Report');
const Diary = require('../models/Diary');
const MemoryScore = require('../models/MemoryScore');
const EmotionAnalysis = require('../models/EmotionAnalysis');

// Flask 서버로 감정 분석 요청
const analyzeDiary = async (diary) => {
  try {
    console.log('전송할 데이터:', { diary });
    const response = await axios.post('http://localhost:5000/predict', 
      { diary }, 
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Flask 서버 응답:', response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Flask 서버 응답 오류:', error.response.data);
      console.error('응답 상태 코드:', error.response.status);
      console.error('응답 헤더:', error.response.headers);
    } else {
      console.error('통신 오류 발생:', error.message);
    }
    throw new Error('감정 분석 요청 중 오류 발생');
  }
};


// 리포트 조회 또는 생성
const getOrCreateReport = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { date } = req.params;

  try {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!date.match(dateRegex)) {
      return res.status(400).json({ message: '날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식이어야 합니다.' });
    }

    const targetDate = new Date(`${date}T00:00:00.000Z`);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();


    const diary = await Diary.findOne({
      userId: userId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!diary) {
      return res.status(404).json({ message: '해당 날짜에 대한 일기를 찾을 수 없습니다.' });
    }

    let report = await Report.findOne({ userId: userId, diaryId: diary._id });

    if (!report) {
      let emotionAnalysis = await EmotionAnalysis.findOne({ diaryId: diary._id });

      if (!emotionAnalysis) {
        const emotions = await analyzeDiary(diary.content);
        emotionAnalysis = new EmotionAnalysis({ userId, diaryId: diary._id, emotions });
        await emotionAnalysis.save();
      }

      const memoryScore = await MemoryScore.findOne({
        userId: userId,
        date: { $gte: new Date(startOfDay), $lte: new Date(endOfDay) },
      });
      console.log('MemoryScore 조회 조건:', {
        userId: userId,
        dateRange: { $gte: new Date(startOfDay), $lte: new Date(endOfDay) }
      });
      
      report = new Report({
        userId,
        diaryId: diary._id,
        date: diary.date,
        cdrScore: memoryScore ? memoryScore.cdrScore : null,
        correctRatio: memoryScore ? memoryScore.correctRatio : null,
        questionCnt: memoryScore ? memoryScore.questionCnt : null,
        correctCnt: memoryScore ? memoryScore.correctCnt : null,
        hintCnt: memoryScore ? memoryScore.hintCnt : null,
        memoryScoreId: memoryScore ? memoryScore._id : null,
        emotions: emotionAnalysis.emotions,
        conditions: diary.healthStatus,
      });

      await report.save();
    }

    res.status(200).json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '리포트 조회 또는 생성 중 오류가 발생했습니다.', error: error.message });
  }
});

// 과거 3일 리포트 자동 생성
const getReportsForLastDays = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // 오늘의 시작 시간 (자정)
    
    const startDate = new Date(today.getTime());  // 복사본 생성
    startDate.setDate(today.getDate() - 3);  // 3일 전부터 시작

    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);  // 오늘의 마지막 시간

    // 지정된 범위 내의 리포트 찾기
    const reports = await Report.find({
      userId: userId,
      date: { $gte: startDate, $lte: endDate },
    })
      .select('date cdrScore correctRatio emotions conditions')
      .populate({
        path: 'diaryId',
        select: 'date healthStatus'
      })
      .exec();

    // 과거 3일 동안 리포트가 없을 경우 자동으로 생성
    for (let i = 0; i < 4; i++) { // 오늘 + 3일 (총 4일)
      const currentDate = new Date();
      currentDate.setDate(today.getDate() - i);
      currentDate.setHours(0, 0, 0, 0);

      const startOfDay = new Date(currentDate);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      let diary = await Diary.findOne({
        userId: userId,
        date: { $gte: startOfDay, $lte: endOfDay },
      });

      if (diary) {
        let report = await Report.findOne({ userId: userId, diaryId: diary._id });

        if (!report) {
          let emotionAnalysis = await EmotionAnalysis.findOne({ diaryId: diary._id });

          if (!emotionAnalysis) {
            const emotions = await analyzeDiary(diary.content);
            emotionAnalysis = new EmotionAnalysis({ userId, diaryId: diary._id, emotions });
            await emotionAnalysis.save();
          }

          const memoryScore = await MemoryScore.findOne({
            userId: userId,
            date: { $gte: startOfDay, $lte: endOfDay },
          });

          report = new Report({
            userId,
            diaryId: diary._id,
            date: diary.date,
            cdrScore: memoryScore ? memoryScore.cdrScore : null,
            correctRatio: memoryScore ? memoryScore.correctRatio : null,
            questionCnt: memoryScore ? memoryScore.questionCnt : null,
            correctCnt: memoryScore ? memoryScore.correctCnt : null,
            hintCnt: memoryScore ? memoryScore.hintCnt : null,
            memoryScoreId: memoryScore ? memoryScore._id : null,
            emotions: emotionAnalysis.emotions,
            conditions: diary.healthStatus,
          });

          await report.save();
        }
      }
    }

    // 생성한 리포트 or 기존 리포트를 응답으로 반환
    const finalReports = await Report.find({
      userId: userId,
      date: { $gte: startDate, $lte: endDate },
    })
      .select('date cdrScore correctRatio emotions conditions')
      .populate({
        path: 'diaryId',
        select: 'date healthStatus'
      })
      .exec();

    res.status(200).json(finalReports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '리포트 조회 또는 생성 중 오류가 발생했습니다.', error: error.message });
  }
});

/*
// 특정 날짜의 리포트 조회
const getReportsByDate = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { date } = req.params;

  try {
    if (!date || isNaN(new Date(date))) {
      return res.status(400).json({ message: '유효하지 않은 날짜 형식입니다.' });
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const reports = await Report.find({
      userId: userId,
      date: { $gte: startOfDay, $lt: endOfDay },
    })
      .select('date cdrScore correctRatio emotions conditions')
      .populate({
        path: 'diaryId',
        select: 'date messages healthStatus'
      })
      .exec();

    if (!reports || reports.length === 0) {
      return res.status(404).json({ message: '해당 날짜에 리포트가 없습니다.' });
    }

    res.status(200).json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '리포트 조회에 실패했습니다.' });
  }
});
*/

module.exports = { getOrCreateReport, getReportsForLastDays };
