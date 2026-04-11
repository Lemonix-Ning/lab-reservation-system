-- Convert open hours columns to TIME

ALTER TABLE `lab_rooms`
  MODIFY `openTimeStart` TIME,
  MODIFY `openTimeEnd` TIME;

ALTER TABLE `opening_rules`
  MODIFY `openTime` TIME,
  MODIFY `closeTime` TIME;
