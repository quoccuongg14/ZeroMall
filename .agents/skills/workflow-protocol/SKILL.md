---
name: workflow-protocol
description: Quy trình làm việc bắt buộc trong dự án ZeroMall: Phân tích yêu cầu và trình bày hướng giải quyết trước khi làm, báo cáo kết quả sau khi làm, và tuyệt đối không tự động chạy sub-agent kiểm thử khi chưa được phép.
---

# ZeroMall Workflow Protocol & Sub-Agent Governance

Quy chuẩn làm việc bắt buộc dành cho trợ lý AI và các tác nhân phát triển trong dự án ZeroMall:

## 1. Quy trình 3 bước bắt buộc (Trước - Trong - Sau)

### Bước 1: Trước khi thực hiện (Before Action)
- **Phân tích yêu cầu**: Làm rõ mục tiêu của người dùng, phân tích nguyên nhân cốt lõi và hiện trạng hệ thống.
- **Trình bày hướng giải quyết**: Trình bày rõ ràng các phương án, kiến trúc thay đổi, các tệp tin sẽ can thiệp.
- **Chờ phản hồi / Thống nhất**: Giải thích logic rõ ràng cho người dùng trước khi bắt tay vào chỉnh sửa code hoặc cấu hình.

### Bước 2: Thực hiện (Execution)
- Áp dụng nguyên tắc Clean Code & Modularity.
- Tuyệt đối không hardcode dữ liệu tĩnh/demo giả mạo.
- Không tự động thực hiện lệnh `git push` (chỉ commit nội bộ).

### Bước 3: Sau khi giải quyết (After Action)
- **Báo cáo những gì đã làm**: Liệt kê chi tiết các thành phần đã tạo mới hoặc chỉnh sửa.
- **Tóm tắt kết quả**: Trình bày trạng thái hoạt động thực tế, cách thức kiểm tra trên giao diện cho người dùng.

---

## 2. Quy định nghiêm ngặt về Sub-Agent & Kiểm Thử (Sub-Agent Governance)

- **TUYỆT ĐỐI KHÔNG TỰ ĐỘNG GỌI SUB-AGENT**:
  - Không tự ý gọi `browser` subagent để truy cập trình duyệt, chụp màn hình hay kiểm thử tự động.
  - Không tự ý phân tán các subagent khác khi người dùng chưa có yêu cầu hoặc chưa cho phép rõ ràng.
- **Khi cần kiểm thử giao diện**: 
  - Mô tả kết quả và hướng dẫn người dùng tự kiểm tra trực tiếp trên trình duyệt, hoặc hỏi ý kiến: *"Bạn có muốn tôi chạy browser subagent để chụp ảnh màn hình kiểm chứng không?"*
  - Chỉ khi người dùng đồng ý mới được kích hoạt subagent.
