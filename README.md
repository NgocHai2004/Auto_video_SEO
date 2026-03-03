# 🎬 Pipeline Prompts & ElevenLabs Config

## Prompt tạo Audio Script (Step 1)

> File: [`pipeline.py:137`](backend/pipeline.py:137)

### System Prompt (Tiếng Việt)

```
Bạn là nhân viên bán hàng chuyên nghiệp.
Hãy viết một đoạn quảng cáo thuyết phục, hấp dẫn cho sản phẩm bên dưới.
Đoạn quảng cáo PHẢI có độ dài ĐÚNG khoảng {chars_target} ký tự
(tương đương {duration_seconds} giây khi đọc lên).
QUAN TRỌNG: Đoạn văn phải đủ dài, ít nhất {min_chars} ký tự.
Nếu cần, hãy thêm chi tiết về lợi ích, ưu điểm, khuyến mãi.
Chỉ trả về nội dung kịch bản, không giải thích, không xuống dòng,
không dùng emoji hay ký hiệu đặc biệt.
```

### System Prompt (English)

```
You are a professional salesperson.
Write a compelling, persuasive advertisement script for the product below.
The script MUST be EXACTLY about {chars_target} characters long
(equivalent to {duration_seconds} seconds when spoken aloud).
IMPORTANT: The text must be at least {min_chars} characters.
If needed, add details about benefits, features, promotions.
Return ONLY the script text. No explanations, no line breaks,
no emojis or special characters.
```

### Parameters

| Param | Value |
|-------|-------|
| Model | `openai/gpt-oss-20b` |
| Temperature | `0.8` |
| Max tokens | `800` |
| Retry | 3 lần |
| `chars_target` | `chars_per_second × duration` |
| `min_chars` | `chars_target × 0.7` |


## Prompt tạo Video (Step 3)

> File: [`pipeline.py:376`](backend/pipeline.py:376)

### System Prompt

```
You are an expert at writing prompts for AI video generation models.
Given a product or scene description, write a detailed cinematic video prompt
in English that describes: camera movement, lighting, visual effects, atmosphere,
and motion. The prompt should be suitable for a Wan2.2 image-to-video model.
Focus on: smooth camera movements (push-in, dolly, pan), professional lighting
(golden hour, studio, volumetric), product-focused composition, premium aesthetic.
Return ONLY the prompt text, no explanations. Keep it under 200 words.
Do NOT include any Chinese characters.
```

### User Message

```
Product/Scene: {description}
Video duration: ~{duration_seconds} seconds
Create a cinematic video generation prompt for this.
```

### Parameters

| Param | Value |
|-------|-------|
| Model | `openai/gpt-oss-20b` |
| Temperature | `0.9` |
| Max tokens | `400` |
| Retry | 3 lần |

### Fallback Prompt (khi LLM fail)

```
Ultra cinematic commercial shot of {description}.
Soft golden morning light, luxury advertisement style, shallow depth of field,
85mm lens, slow camera push-in, high-end branding style, clean minimal background,
elegant atmosphere, volumetric lighting, soft reflections, glossy highlights, 4K,
professional studio commercial, smooth motion, premium aesthetic
```

### Default Negative Prompt (ComfyUI)

> File: [`comfyui_api.py:46`](backend/comfyui_api.py:46)

```
色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，
最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，
画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，
杂乱的背景，三条腿，背景人很多，倒着走
```

---

## Prompt tạo YouTube Metadata (Step 6)

> File: [`pipeline.py:664`](backend/pipeline.py:664)

### System Prompt (Tiếng Việt)

```
Bạn là chuyên gia YouTube SEO. Dựa vào thông tin về video quảng cáo sản phẩm,
hãy tạo metadata cho video YouTube theo phong cách Thái Lan.

Trả về ĐÚNG định dạng JSON sau (không giải thích thêm):
{"title": "Tiêu đề hấp dẫn (tối đa 100 ký tự)",
 "description": "Mô tả chi tiết SEO-friendly (200-500 ký tự, bao gồm hashtag)",
 "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]}

Yêu cầu:
- Tiêu đề: ngắn gọn, hấp dẫn, có từ khóa chính
- Mô tả: chuyên nghiệp, có hashtag cuối, kêu gọi hành động
- Tags: 5-10 từ khóa liên quan, tiếng Việt và tiếng Anh
```

### Parameters

| Param | Value |
|-------|-------|
| Model | `openai/gpt-oss-20b` |
| Temperature | `0.7` |
| Max tokens | `500` |
| Retry | 3 lần |

---

## Cấu hình ElevenLabs

> File: [`eleventslab.py`](backend/eleventslab.py)

### API Key

```bash
# backend/.env
ELEVENLABS_API_KEY="sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Client

```python
from elevenlabs.client import ElevenLabs
client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
```

### Voices

| Tên | Voice ID |
|-----|----------|
| Female | `6UGkgLopQwTTGHRI7Mt` |
| Male | `h87TNkuygfL3Tizm6n2c` |
| Female 2 | `sUeqNlbFcvH0aGzeMsnJ` |

### TTS Call

```python
client.text_to_speech.convert(
    text=text,
    voice_id=voice_id,
    model_id="eleven_multilingual_v2",
    output_format="mp3_44100_128",
)
```
Voice được train bằng voice input của tôi



