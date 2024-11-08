// 자가진단 컨트롤러
// 0829 ver - JWT 토큰에서 userId 추출하도록
const asyncHandler = require('express-async-handler');
const Assessment = require('../models/Assessment');
const ElderlyUser = require('../models/ElderlyUser');
const GuardianUser = require('../models/GuardianUser'); 


// 새로운 자가진단 결과 생성
exports.createAssessment = asyncHandler(async (req, res) => {
  try {
    const { questionnaireType, score, date } = req.body;
    const userId = req.user._id; // JWT 토큰에서 추출한 userId (보호자 ID)

    // 자가진단 유형 확인
    if (!['KDSQ', 'PRMQ'].includes(questionnaireType)) {
      return res.status(400).json({ message: 'Invalid questionnaire type' });
    }

    // 보호자용 KDSQ 자가진단인 경우
    if (questionnaireType === 'KDSQ') {
      // 보호자의 ID로 노인 사용자를 찾음 (보호자의 phone을 노인 사용자의 guardianPhone과 매칭)
      const guardian = await GuardianUser.findById(userId);
      //console.log('Guardian Data:', guardian); // guardian 정보 로그 출력
      const elderlyUser = await ElderlyUser.findOne({ guardianPhone: guardian.phone }); // 노인 사용자 찾기
      //console.log('ElderlyUser Data:', elderlyUser); 

      if (!elderlyUser) {
        return res.status(404).json({ message: '연동된 노인 사용자가 없습니다.' });
      }

      // 노인 사용자의 ID로 자가진단 결과 생성
      const newAssessment = new Assessment({
        userId: elderlyUser._id, // 연동된 노인 사용자의 ID
        guardianId: userId, // 보호자 ID
        questionnaireType,
        score,
        date
      });
      await newAssessment.save();
      res.status(201).json({ message: '성공', data: {assessment:newAssessment, name:elderlyUser.name} });
      console.log({ message: '성공', data: {assessment:newAssessment, name:elderlyUser.name} });

    } else if (questionnaireType === 'PRMQ') {
      // 노인 사용자 자가진단인 경우 (보호자가 아닌 노인 사용자 자신의 자가진단)
      const elderlyUser = await ElderlyUser.findById(userId);
      if (!elderlyUser) {
        return res.status(404).json({ message: '노인 사용자를 찾을 수 없습니다.' });
      }

      const newAssessment = new Assessment({
        userId: elderlyUser._id, // 노인 사용자 ID
        guardianId: null, // PRMQ는 보호자 ID 필요 없음
        questionnaireType,
        score,
        date
      });
      await newAssessment.save();
      res.status(201).json({ message: '성공', data: newAssessment });
    }
  } catch (error) {
    res.status(500).json({ message: '실패', error });
  }
});



// 특정 사용자의 자가진단 결과 조회
exports.getAssessmentsByUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id; // JWT 토큰에서 추출한 userId
    
    let assessments = await Assessment.find({
      userId,
    });
    console.log(assessments);


     //보호자 사용자인 경우 노인 사용자 아이디를 찾는 추가 작업 필요
     if (req.user.role === "guardian"){
      const guardian = await GuardianUser.findById(userId);
      const elderly=await ElderlyUser.findOne({name:guardian.elderlyName, guardianPhone: guardian.phone});
      let assessments2= await Assessment.find({userId:elderly._id});
      assessments.push(...assessments2); 
      assessments.sort((a, b) => b.date - a.date); //날짜 최근부터
      console.log(assessments);
     }

    if (assessments.length === 0) {
      return res.status(404).json({ message: '자가진단 결과를 찾을 수 없습니다.' });
    }

    res.status(200).json({ data: assessments });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving assessments', error });
  }
});

// 특정 날짜에 해당하는 자가진단 결과 조회
exports.getAssessmentsByDate = asyncHandler(async (req, res) => {
  try {
    const { date } = req.params; // URL 경로에서 날짜를 받음
    const userId = req.user._id; // JWT 토큰에서 추출한 userId

    // 조회할 날짜의 시작과 끝을 설정
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1); // 다음 날로 설정하여 당일 자정까지 포함

    // 노인 사용자와 보호자를 구분하여 자가진단 결과를 조회
    let assessments;

    // 노인 사용자인 경우
    if (req.user.role === "elderly") {
      assessments = await Assessment.find({
        userId,
        date: {
          $gte: startDate,  // 지정한 날짜의 00:00:00
          $lt: endDate      // 다음 날 00:00:00 전까지
        }
      });
    }

    // 보호자인 경우, 보호자와 연동된 노인 사용자의 자가진단 결과를 조회
    if (req.user.role === "guardian") {
      // 보호자의 ID로 노인 사용자를 찾음 (보호자의 phone을 노인 사용자의 guardianPhone과 매칭)
      const guardian = await GuardianUser.findById(userId);
      const elderlyUser = await ElderlyUser.findOne({ guardianPhone: guardian.phone }); // 노인 사용자 찾기

      if (!elderlyUser) {
        return res.status(404).json({ message: '연동된 노인 사용자가 없습니다.' });
      }

      assessments = await Assessment.find({
        userId: elderlyUser._id, // 연동된 노인 사용자의 ID로 조회
        date: {
          $gte: startDate,  // 지정한 날짜의 00:00:00
          $lt: endDate      // 다음 날 00:00:00 전까지
        }
      });
    }

    if (assessments.length === 0) {
      return res.status(404).json({ message: '해당 날짜에 자가진단 결과를 찾을 수 없습니다.' });
    }

    res.status(200).json({ data: assessments });
  } catch (error) {
    console.error('자가진단 조회 오류:', error); // 에러 로그 추가
    res.status(500).json({ message: '자가진단 결과 조회 중 오류가 발생했습니다.', error });
  }
});

/*
// 특정 자가진단 결과 삭제
exports.deleteAssessment = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id; // JWT 토큰에서 추출한 userId

    const assessment = await Assessment.findOne({ _id: id, userId });

    if (!assessment) {
      return res.status(404).json({ message: '자가진단 결과를 찾을 수 없습니다.' });
    }

    await Assessment.findByIdAndDelete(id);
    res.status(200).json({ message: '삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ message: '삭제 실패', error });
  }
});
*/