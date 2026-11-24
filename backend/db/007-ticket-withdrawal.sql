ALTER TABLE tickets DROP CONSTRAINT tickets_status_check;

ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('Mới', 'Đang xử lý', 'Chờ phản hồi', 'Đã chuyển', 'Đã giải quyết', 'Đã đóng', 'Đã thu hồi'));
