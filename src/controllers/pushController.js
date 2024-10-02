const { messaging } = require('../utils/firebaseConfig');
const Alarm = require('../models/alarm');
const schedule = require('node-schedule');
const asyncHandler = require('express-async-handler');

// 푸시 알림 전송 함수
const sendPushNotice = asyncHandler(async (req, res) => {
  const userId = req.user._id;  // JWT 인증을 통해 userId 추출

  // 알림 설정을 사용자의 userId로 조회
  const alarm = await Alarm.findOne({ userId }); // 사용자별로 알림 설정 가져오기

  // 알림 설정이 없는 경우
  if (!alarm) {
    return res.status(404).json({ message: '알림 설정을 찾을 수 없습니다.' });
  }

  // 사용자가 설정한 시간 가져오기, 기본값은 17:00
  let hour = alarm.hour ?? 17;
  let minute = alarm.minute ?? 0;

  // 클라이언트에서 전달받은 사용자 토큰
  const registrationToken = 'Registration token from the client'; // 클라이언트에서 토큰을 받아와야 함

  try {
    // 푸시 알림 메시지 정의
    const message = {
      notification: {
        title: '일기를 작성할 시간이에요!',
      },
      android: {
        notification: {
          icon: 'stock_ticker_update',
          color: '#7e55c3',
        }
      },
      tokens: [registrationToken],  
      topic: '일기 작성 알림',
    };

     // 기존 스케줄 작업이 있으면 취소 (중복 스케줄 방지)
     if (schedule.scheduledJobs[userId]) {
      schedule.scheduledJobs[userId].cancel();
    }

    // 특정 시간에 푸시 알림을 스케줄링
    let pushNotice = schedule.scheduleJob(`${minute} ${hour} * * *`, function() {
      console.log(`${minute}분 ${hour}시에 알림 전송`);

      // Firebase를 통해 메시지 전송
      messaging().sendMulticast(message)
        .then((response) => {
          console.log('메시지 알림 전송 성공', response);
        })
        .catch((error) => {
          console.error('메시지 알림 전송 중 에러 발생', error);
        });
    });

    // 성공적으로 스케줄링되었음을 클라이언트에 응답
    res.status(200).json({ message: '알림 전송이 스케줄링되었습니다.' });

  } catch (error) {
    console.error('푸시 알림 전송 중 에러 발생:', error);
    res.status(500).json({ message: '메시지 알림 전송 중 에러 발생', error });
  }
});

// 알람 시간 수정 컨트롤러
const updateAlarmTime = asyncHandler(async (req, res) => {
  const userId = req.user._id;  // JWT 인증에서 추출된 사용자 ID
  const { hour, minute } = req.body;  // 클라이언트에서 전달받은 시간과 분

  // 시간과 분의 유효성 검사 (0-23 시간, 0-59 분)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return res.status(400).json({ message: '유효하지 않은 시간 또는 분입니다.' });
  }

  try {
    // 사용자의 알림 설정을 찾아 업데이트
    let alarm = await Alarm.findOne({ userId });

    if (alarm) {
      // 기존 알람 설정이 있을 경우 업데이트
      alarm.hour = hour;
      alarm.minute = minute;
      await alarm.save();
    } else {
      // 알람 설정이 없을 경우 새로 생성
      alarm = new Alarm({
        userId,
        hour,
        minute,
        pushId: Date.now(), // pushId를 고유한 값으로 생성
      });
      await alarm.save();
    }

    res.status(200).json({ message: '알림 시간이 업데이트되었습니다.', alarm });

  } catch (error) {
    console.error('알람 시간 수정 중 오류 발생:', error);
    res.status(500).json({ message: '알람 시간 수정에 실패했습니다.', error });
  }
});


module.exports = { sendPushNotice, updateAlarmTime };
