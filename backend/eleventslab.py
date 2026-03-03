import os
import random
import gradio as gr
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

# Load API key from .env file (ELEVENLABS_API_KEY)
api_key = os.getenv("ELEVENLABS_API_KEY")
if not api_key:
    raise ValueError("ELEVENLABS_API_KEY not found in .env file. Please add it.")

client = ElevenLabs(api_key=api_key)

# Hardcoded Vietnamese voices (since API key doesn't have voices_read permission)
# These are common ElevenLabs pre-made voice IDs that support Vietnamese via multilingual model
voice_dict = {
    "Female": "6UGkgbLopQwTTGHRI7Mt",
    "Male": "h87TNkuygfL3Tizm6n2c",
    "Female 2":"sUeqNlbFcvH0aGzeMsnJ"
}
voice_names = list(voice_dict.keys())


def generate_audio(text, selected_voice, random_voice):
    if random_voice:
        selected_voice = random.choice(voice_names)

    voice_id = voice_dict[selected_voice]

    audio_generator = client.text_to_speech.convert(
        text=text,
        voice_id=voice_id,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )

    # Convert generator to bytes
    audio_bytes = b"".join(audio_generator)

    filename = "output.mp3"
    with open(filename, "wb") as f:
        f.write(audio_bytes)

    return filename, selected_voice


with gr.Blocks() as demo:
    gr.Markdown("## 🎙️ ElevenLabs Vietnamese Voice Generator")

    text_input = gr.Textbox(
        label="Nhập nội dung",
        value="Xin chào, đây là hệ thống chọn giọng tự động."
    )

    voice_dropdown = gr.Dropdown(
        choices=voice_names,
        label="Chọn Voice",
        value=voice_names[0] if voice_names else None
    )

    random_checkbox = gr.Checkbox(label="Random Voice")

    generate_btn = gr.Button("Tạo Audio")

    audio_output = gr.Audio(label="Kết quả")
    voice_used = gr.Textbox(label="Voice đã dùng")

    generate_btn.click(
        generate_audio,
        inputs=[text_input, voice_dropdown, random_checkbox],
        outputs=[audio_output, voice_used]
    )

demo.launch(share=True)