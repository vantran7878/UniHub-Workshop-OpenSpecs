/**
 * Event Reminder Email Template
 * @eventTypes - Workshop, TrainingSession, Webinar
 */
export const eventReminderTemplate = {
  subject: "Nhắc nhở về {{eventName}}",
  htmlBody: `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nhắc Nhở Workshop</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
        .header { text-align: center; color: #333333; font-size: 14pt; margin-bottom: 20px; }
        .content { color: #666666; font-size: 9pt; line-height: 1.5; padding: 0 20px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 10pt; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; color: #999999; font-size: 8pt; padding-top: 20px; border-top: 1px solid #eeeeee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">📅 Nhắc nhở sự kiện!</div>
        <div class="content">
            <p>Kính gửi,</p>
            <p>Nhắc nhở về workshop sắp tới:</p>
            <p><strong>{{eventName}}</strong></p>
            <p>Lịch trình: {{eventDate}}</p>
            <p>Địa điểm: {{eventLocation}}</p>
            <hr style="border-top: 1px solid #cccccc; margin: 20px 0;">
            <p>Vui lòng chuẩn bị đầy đủ thông tin cần thiết để tham gia.</p>
            <a href="{{registrationUrl}}" class="button">Đăng ký lại</a>
        </div>
        <div class="footer">
            <p>UniHub Workshop Team</p>
        </div>
    </div>
</body>
</html>`,
  textBody: "Kính gửi,\n\nNhắc nhở về workshop sắp tới:\n\n{{eventName}}\nLịch trình: {{eventDate}}\nĐịa điểm: {{eventLocation}}\n\nVui lòng chuẩn bị đầy đủ thông tin cần thiết để tham gia.\nĐăng ký lại tại: {{registrationUrl}}\n\nUniHub Workshop Team"
}
