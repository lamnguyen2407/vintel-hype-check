# Khen CLB — AI Compliment Battle

Trò chơi 1v1 dành cho Vintelligence Club Fair. Hai người chơi có 15 giây mỗi lượt để khen Vintelligence/VinUniversity; lời nói được chuyển thành văn bản trực tiếp và AI chấm theo bốn tiêu chí.

## Tính năng

- Hai người chơi, hai round, tự cộng tổng điểm.
- Countdown 3 giây và timer 15 giây.
- Live speech-to-text tiếng Việt hoặc tiếng Anh bằng Web Speech API.
- Cho host sửa transcript trước khi gửi chấm.
- OpenAI Structured Outputs với Zod; API key chỉ tồn tại ở server.
- Chấm đồng thời Player A và B để giảm thiên vị.
- Bốn tiêu chí: sáng tạo 30, hoa mỹ 25, đúng chủ đề 25, độ nịnh 20.
- Backup Judge tất định khi chưa có API key hoặc mất kết nối.
- Giao diện fullscreen, responsive và tối ưu cho màn hình booth.
- Chặn prompt injection cơ bản bằng system prompt và phân tách transcript.

## Chạy local

Yêu cầu Node.js 20.9 trở lên.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) bằng Google Chrome.

Điền `.env.local` để bật OpenAI Judge:

```env
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-6-astra
```

Nếu không có `OPENAI_API_KEY`, ứng dụng vẫn chơi trọn vẹn bằng Backup Judge và hiển thị nhãn tương ứng.

## Điều khiển nhanh

- Nhấn `Space` ở màn chờ để bắt đầu lượt.
- Nhấn `Space` khi đang nói để kết thúc sớm.
- Có thể chọn Vietnamese/English riêng cho mỗi người chơi.
- Có thể sửa transcript hoặc nhập tay nếu môi trường quá ồn.

## Kiểm tra trước Club Fair

```bash
npm run lint
npm run typecheck
npm run build
npm run start
```

Test trên đúng laptop và microphone dùng tại booth. Cấp quyền microphone cho Chrome trước giờ sự kiện và chuẩn bị hotspot riêng.

## Kiến trúc

```text
Browser microphone
  → Web Speech API
  → editable transcript
  → POST /api/judge
  → OpenAI structured score hoặc Backup Judge
  → round score → final winner
```

`src/app/api/judge/route.ts` giữ API key ở server. Frontend không nhận hoặc lưu secret.
