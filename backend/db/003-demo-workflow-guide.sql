-- Update only the unchanged guide created by the old demo seed.
-- Preserve articles that users have written or edited themselves.
UPDATE documents
SET content='Nhân viên gửi yêu cầu. Admin phân công Helpdesk hoặc Technician. Người được giao giải quyết và chat với người yêu cầu. Technician có thể trả Ticket về hàng đợi Helpdesk kèm lý do để Admin phân công lại. Người phụ trách ghi kết quả. Người yêu cầu xác nhận đóng hoặc yêu cầu xử lý tiếp.',
    updated_at=now()
WHERE title='Quy trình xử lý sự cố CNTT'
  AND content='Nhân viên gửi yêu cầu. Helpdesk xác minh và tiếp nhận. Nếu cần chuyên môn sâu, chuyển cho Technician kèm các bước đã thử. Người phụ trách ghi kết quả. Người yêu cầu xác nhận đóng hoặc yêu cầu xử lý tiếp.';
