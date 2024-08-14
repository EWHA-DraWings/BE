// 0813: 역할 수정(일기 조회, 수정, 삭제) - 생성은 chatController에서!
const asyncHandler = require('express-async-handler');
const ElderlyUser = require('../models/ElderlyUser');
const Diary = require('../models/Diary');
const mongoose = require('mongoose');

//사용자 id(/:userId)로 일기 전체 조회
const getAllDiaries=asyncHandler(async (req, res) => {
  const userId=req.params.userId;

  try {  
    //사용자 확인
    const user = await ElderlyUser.findOne({id:userId});
    if (!user) {
      res.status(400).json({ message: '사용자가 없습니다.' });
      return;
    }
    
    const userObjectId = new mongoose.Types.ObjectId(user._id);
    
    //userId인 사용자의 모든 일기 조회
    const diaries = await Diary.find({userId:userObjectId});
    if (!diaries) {
      res.status(404).json({ message: '일기가 없습니다.' });
      return;
    }  

    res.status(200).json(diaries);
    
  } catch (error) {
    res.status(500).json({ message: '일기 전체 조회에 실패했습니다.' });
  }
});

//일기 id(/:userId/:diaryId)로 특정 일기 조회
const getDiary=asyncHandler(async (req, res) => {
  const userId= req.params.userId;
  const diaryId = req.params.diaryId.trim();//공백문자 제거
  try {  
    //사용자 확인
    const user = await ElderlyUser.findOne({id:userId});
    if (!user) {
      res.status(400).json({ message: '사용자가 없습니다.' });
      return;
    }

    // 일기 찾기
    const diary = await Diary.findById(diaryId);
    if (!diary) {
      res.status(404).json({ message: '일기를 찾을 수 없습니다.' });
      return;
    }
    
    if (!diary.userId.equals(user._id)) { // 일기는 존재하지만 다른 사용자의 일기인지 확인(objectId라서 equals로 비교)
      res.status(401).json({ message: '접근 권한이 없는 일기입니다.' });
      return;
    }

    res.status(200).json(diary);

  } catch (error) {
    res.status(500).json({ message: '일기 조회에 실패했습니다.' });
    console.log(error);
  }
});

//일기 id(/:userId/:diaryId)로 일기 삭제
const deleteDiary=asyncHandler(async (req, res) => {
  const userId= req.params.userId;
  const diaryId = req.params.diaryId.trim();//공백문자 제거

  try {
    //사용자 확인
    const user = await ElderlyUser.findOne({id:userId});
    if (!user) {
      res.status(400).json({ message: '사용자가 없습니다.' });
      return;
    }

    // 일기 찾기
    const diary = await Diary.findById(diaryId);
    if (!diary) {
      res.status(404).json({ message: '일기를 찾을 수 없습니다.' });
      return;
    }
    if (!diary.userId.equals(user._id)) { // 일기는 존재하지만 다른 사용자의 일기인지 확인(objectId라서 equals로 비교)
      res.status(401).json({ message: '접근 권한이 없는 일기입니다.' });
      return;
    }

    //일기 삭제
    const result = await Diary.findOneAndDelete({ userId: diary.userId, _id: diaryId });

    //삭제된 일기가 없는 경우
    if (!result) {
      return res.status(404).json({ message: '삭제할 수 없는 일기입니다.' });
    }

    res.status(200).json({ message: '일기 삭제 성공', deletedDiary: result });
    
  } catch (error) {
    res.status(500).json({ message: '일기 삭제 실패' });
  }
});

//일기 id(/:userId/:diaryId)로 일기 수정
const updateDiary=asyncHandler(async (req, res) => {
  const updatedContent = req.body.content; 
  const userId= req.params.userId;
  const diaryId = req.params.diaryId.trim();//공백문자 제거
  try {  
    //사용자 확인
    const user = await ElderlyUser.findOne({id:userId});
    if (!user) {
      res.status(400).json({ message: '사용자가 없습니다.' });
      return;
    }

    // 일기 찾기
    const diary = await Diary.findById(diaryId);
    if (!diary) {
      res.status(404).json({ message: '일기를 찾을 수 없습니다.' });
      return;
    }
    
    if (!diary.userId.equals(user._id)) { // 일기는 존재하지만 다른 사용자의 일기인지 확인(objectId라서 equals로 비교)
      console.log(diary.userId);
      console.log(user._id);
      res.status(401).json({ message: '접근 권한이 없는 일기입니다.' });
      return;
    }

    //일기 수정
    const result = await Diary.findOneAndUpdate(
      { userId: diary.userId, _id: diaryId },
      { content: updatedContent },
      { new: true } //new:업데이트된 문서 반환
    );

    //수정한 일기가 없는 경우
    if (!result) {
      return res.status(404).json({ message: '수정할 수 없는 일기입니다.' });
    }

    res.status(200).json({ message: '일기 수정 성공', updatedDiary: result });
    
  } catch (error) {
    res.status(500).json({ message: '일기 수정 실패' });
    console.log(error);
  }
});

module.exports = { getAllDiaries, getDiary, deleteDiary, updateDiary };
