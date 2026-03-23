# 🚀 AI-Serverless Developer Framework (ASDF) - Master Blueprint

## 1. Tổng quan Dự án (Project Overview)
Hệ thống phát triển Web/Chatbot từ xa thông qua giao diện Web di động (GitHub Pages).
* **Tư duy cốt lõi:** Dùng GitHub Actions làm "máy chủ tạm thời", Gemini 1.5 Pro làm "lập trình viên" chính.
* **Mục tiêu:** Code mọi lúc mọi nơi, không cần máy trạm 24/7, chi phí vận hành $0 (tận dụng gói Gemini Advanced).

## 2. Kiến trúc Kỹ thuật (Technical Architecture)

### A. Sơ đồ luồng (System Flow)
1. **User UI (GitHub Pages):** Giao diện Chat + Auto-suggest lệnh `/`.
2. **Dispatcher (GitHub API):** Nhận lệnh từ UI và kích hoạt Workflow qua `repository_dispatch`.
3. **Runner (GitHub Actions):** Khởi động máy ảo Ubuntu, nạp Context dự án (Source code hiện tại).
4. **AI Brain (Gemini 1.5 Pro):** Nhận toàn bộ code cũ + Yêu cầu mới -> Trả về mã nguồn đã chỉnh sửa.
5. **Auto-Deploy:** Git Push ngược lại Repo -> Vercel/GitHub Pages tự động cập nhật sản phẩm.



### B. Thành phần công nghệ:
* **Frontend:** HTML/JS (Vanilla) + Tailwind CSS + Lucide Icons (Host trên GitHub Pages).
* **Backend:** GitHub Actions (Runner).
* **AI:** Google Generative AI (Gemini 1.5 Pro - API v1beta).
* **Deployment:** Vercel (Frontend) / Cloudflare Workers (Bot API).

---

## 3. Hệ thống Lệnh (Command Registry & Suggestions)

Giao diện Web phải hỗ trợ gợi ý (Autocomplete) các lệnh sau khi người dùng gõ `/`:

| Lệnh | Mô tả | Hành động của Agent |
| :--- | :--- | :--- |
| `/gen` | Tạo hoặc sửa code | Gọi Gemini viết code + Commit |
| `/fix` | Sửa lỗi dựa trên log | Phân tích lỗi terminal + Sửa file |
| `/build` | Kiểm tra lỗi build | Chạy `npm run build` hoặc `python -m py_compile` |
| `/tree` | Xem cấu trúc folder | Trả về sơ đồ cây của thư mục `/src` |
| `/preview` | Lấy link demo | Trả về URL Vercel/GH-Pages mới nhất |
| `/clear` | Làm mới hội thoại | Xóa file lịch sử context trên Repo |
| `/deploy` | Merge code | Đẩy code từ nhánh `dev` sang `main` |

---

## 4. Cấu trúc Thư mục Dự án (Project Structure)

```text
├── .github/
│   └── workflows/
│       └── ai-engine.yml        # Workflow xử lý logic thực thi
├── ai_scripts/
│   ├── core_agent.py           # Script Python kết nối Gemini 1.5 Pro
│   └── utils.py                # Công cụ quét file, nén context gửi AI
├── web_remote/
│   ├── index.html              # Giao diện điều khiển trên điện thoại
│   └── app.js                  # Logic xử lý gợi ý lệnh và gọi GitHub API
├── src/                        # Nơi chứa sản phẩm chính (Web/App/Chatbot)
├── instructions.md             # "Luật" coding (ví dụ: Dùng React, Tailwind...)
└── status.json                 # File cập nhật trạng thái Action để UI hiển thị
```

---

## 5. Hướng dẫn Triển khai Chi tiết

**Bước 1: Bảo mật API Key**
1. Lưu GEMINI_API_KEY vào GitHub Secrets.

2. Tạo **Personal Access Token (PAT)** với quyền `repo` và `workflow`, lưu vào Secret tên `GH_TOKEN`.

**Bước 2: Script Điều phối AI (core_agent.py)**
Script này phải:
1. Đọc nội dung file instructions.md.
2. Quét toàn bộ file trong /src (Trình thu thập Context).
3. Gửi Prompt: "Dựa trên code hiện tại và luật trong instructions.md, hãy thực hiện: [Lệnh từ người dùng]. Trả về code dưới dạng file-path:content".
4. Parse kết quả và ghi đè (Overwrite) vào các file vật lý trong máy ảo GitHub.

**Bước 3: Giao diện Remote UI (web_remote)**
* Sử dụng fetch() để gửi repository_dispatch tới GitHub API.
* Tích hợp bộ lọc gợi ý khi phát hiện ký tự / trong ô nhập liệu.

## 6. Chỉ thị cho AI Agent (Instructions for Antigravity)
**Yêu cầu 1**: "Dựa trên ASDF-SYSTEM-DESIGN.md, hãy viết file ai_scripts/core_agent.py. Sử dụng thư viện google-generativeai để giao tiếp với Gemini 1.5 Pro. Đảm bảo Agent có khả năng tự sửa lỗi nếu phát hiện cú pháp code trả về bị lỗi."

**Yêu cầu 2**: "Viết file web_remote/index.html giao diện Mobile-first. Thanh input phải có Popup gợi ý các lệnh /gen, /fix, /build kèm mô tả chi tiết."

## 7. Cơ chế "Tự chữa lỗi" (Self-Healing)
Nếu lệnh /build thất bại, GitHub Action sẽ tự động thu thập Log lỗi, gửi ngược lại cho Gemini với yêu cầu: "Code vừa cập nhật gây lỗi build, hãy đọc log và sửa lại ngay". Quy trình lặp lại tối đa 3 lần. Nếu không build thành công, đảm bảo phiên bản chạy được gần nhất được khôi phục.