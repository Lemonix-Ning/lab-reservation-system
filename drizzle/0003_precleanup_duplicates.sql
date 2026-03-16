-- Pre-cleanup before adding UNIQUE constraints

-- course_students: remove duplicates, keep lowest id
DELETE cs1 FROM `course_students` cs1
JOIN `course_students` cs2
  ON cs1.`courseId` = cs2.`courseId`
 AND cs1.`studentId` = cs2.`studentId`
 AND cs1.`id` > cs2.`id`;

-- class_students: remove duplicates, keep lowest id
DELETE cs1 FROM `class_students` cs1
JOIN `class_students` cs2
  ON cs1.`classId` = cs2.`classId`
 AND cs1.`studentId` = cs2.`studentId`
 AND cs1.`id` > cs2.`id`;

-- blacklist: remove duplicates by userId, keep lowest id
DELETE b1 FROM `blacklist` b1
JOIN `blacklist` b2
  ON b1.`userId` = b2.`userId`
 AND b1.`id` > b2.`id`;
