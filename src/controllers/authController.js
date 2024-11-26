const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const ElderlyUser = require("../models/ElderlyUser");
const GuardianUser = require("../models/GuardianUser");
const Alarm = require("../models/alarm"); // 알람 모델 이름 수정

// JWT 생성
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d", // 만료 기간
  });
};

// 로그인(보호자, 사용자)
const loginUser = asyncHandler(async (req, res) => {
  const { id, password } = req.body;

  try {
    // 노인, 보호자 확인
    const elderlyUser = await ElderlyUser.findOne({ id: id });
    const guardianUser = await GuardianUser.findOne({ id: id });

    // 노인 사용자
    if (elderlyUser) {
      if (await bcrypt.compare(password, elderlyUser.password)) {
        // 알람 시간 확인
        const userAlarm = await Alarm.findOne({ userId: elderlyUser._id }); // 변수 이름 변경
        const hasAlarm = !!userAlarm; // 알람이 존재하면 true, 없으면 false

        res.json({
          _id: elderlyUser._id,
          id: elderlyUser.id,
          name: elderlyUser.name,
          token: generateToken(elderlyUser._id),
          isElderly: true,
          hasAlarm, // 알람 여부 추가
        });
      } else {
        res.status(401).json({ message: "사용자님의 아이디 또는 비밀번호가 올바르지 않습니다." });
      }
      return;
    }

    // 보호자 사용자
    if (guardianUser) {
      if (await bcrypt.compare(password, guardianUser.password)) {
        // 알람 시간 확인
        const userAlarm = await Alarm.findOne({ userId: guardianUser._id }); // 변수 이름 변경
        const hasAlarm = !!userAlarm; // 알람이 존재하면 true, 없으면 false

        res.json({
          _id: guardianUser._id,
          id: guardianUser.id,
          name: guardianUser.elderlyName,
          token: generateToken(guardianUser._id),
          isElderly: false,
          hasAlarm, // 알람 여부 추가
        });
      } else {
        res.status(401).json({ message: "사용자님의 아이디 또는 비밀번호가 올바르지 않습니다." });
      }
      return;
    }

    // 사용자 없음
    res.status(401).json({ message: "사용자님의 아이디 또는 비밀번호가 올바르지 않습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

module.exports = { loginUser };
