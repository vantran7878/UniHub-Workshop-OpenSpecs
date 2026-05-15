## ADDED Requirements

### Requirement: Trigger AI Processing on Upload
Khi một tài liệu PDF được upload lên workshop, hệ thống SHALL kích hoạt một tác vụ tóm tắt AI chạy ngầm.

#### Scenario: PDF Document Uploaded
- **WHEN** Admin upload một file PDF mới cho workshop.
- **THEN** Hệ thống SHALL đẩy một message chứa `{workshop_id, file_path}` vào queue `ai_summary_queue`.

### Requirement: Async Metadata Update
Sau khi AI hoàn thành việc tóm tắt, kết quả SHALL được cập nhật vào trường `summary` trong database.

#### Scenario: AI Summary Completed
- **WHEN** AI Worker hoàn thành việc phân tích và tóm tắt PDF.
- **THEN** Nó SHALL cập nhật bản ghi workshop tương ứng và gửi thông báo hoàn thành.
