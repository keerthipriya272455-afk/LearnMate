from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from dotenv import load_dotenv
from google import genai
from google.genai import types
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    logout_user,
    login_required,
    current_user
)
import time

import os
import json
import base64
import sqlite3
from datetime import datetime, date, timedelta
import time
import wave
import io


# =========================================================
# LOAD ENVIRONMENT
# =========================================================

load_dotenv(override=True)

key = os.getenv("GEMINI_API_KEY")

print("GEMINI KEY LOADED:", bool(key))

if key:
    print("GEMINI KEY START:", key[:5])
else:
    print("GEMINI KEY START: NONE")


# =========================================================
# FLASK APP
# =========================================================

app = Flask(__name__)

app.secret_key = os.getenv(
    "SECRET_KEY",
    "studyai-secret-key"
)

login_manager = LoginManager()

login_manager.init_app(app)

login_manager.login_view = "login"
# =========================================================
# GEMINI CLIENT
# =========================================================

client = genai.Client(api_key=key)

print("GEMINI CLIENT CREATED SUCCESSFULLY")


# =========================================================
# DATABASE
# =========================================================
DATABASE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "studyai.db"
)

print("DATABASE BEING USED:", DATABASE)



def get_db():

    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row

    return conn


def init_database():

    conn = get_db()

    # =====================================================
    # USERS
    # =====================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            profile_picture TEXT,
            created_at TEXT NOT NULL
        )
    """)

    # Add profile_picture if an old users table doesn't have it
    user_columns = [
        row["name"]
        for row in conn.execute(
            "PRAGMA table_info(users)"
        ).fetchall()
    ]

    if "profile_picture" not in user_columns:
        conn.execute("""
            ALTER TABLE users
            ADD COLUMN profile_picture TEXT
        """)


    # =====================================================
    # TOPICS
    # =====================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            topic TEXT NOT NULL,
            last_used TEXT NOT NULL,
            UNIQUE(user_id, topic)
        )
    """)

    topic_columns = [
        row["name"]
        for row in conn.execute(
            "PRAGMA table_info(topics)"
        ).fetchall()
    ]

    if "user_id" not in topic_columns:
        conn.execute("""
            ALTER TABLE topics
            ADD COLUMN user_id INTEGER
        """)


    # =====================================================
    # QUIZZES
    # =====================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            topic TEXT NOT NULL,
            score INTEGER NOT NULL,
            total INTEGER NOT NULL,
            completed_at TEXT NOT NULL
        )
    """)

    quiz_columns = [
        row["name"]
        for row in conn.execute(
            "PRAGMA table_info(quizzes)"
        ).fetchall()
    ]

    if "user_id" not in quiz_columns:
        conn.execute("""
            ALTER TABLE quizzes
            ADD COLUMN user_id INTEGER
        """)


    # =====================================================
    # STUDY DAYS
    # =====================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS study_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            study_date TEXT NOT NULL
        )
    """)

    study_columns = [
        row["name"]
        for row in conn.execute(
            "PRAGMA table_info(study_days)"
        ).fetchall()
    ]

    if "user_id" not in study_columns:
        conn.execute("""
            ALTER TABLE study_days
            ADD COLUMN user_id INTEGER
        """)


    conn.commit()
    conn.close()

    print("DATABASE SCHEMA CHECKED SUCCESSFULLY")
    # ============================================================
# STUDY DAY
# ============================================================

def record_study_day():
    conn = get_db()

    conn.execute("""
        INSERT OR IGNORE INTO study_days (study_date)
        VALUES (?)
    """, (
        date.today().isoformat(),
    ))

    conn.commit()
    conn.close()
def clean_json_response(text):

    if not text:
        raise ValueError(
            "Gemini returned an empty response."
        )

    text = str(text).strip()

    if text.startswith("```json"):
        text = text[7:].strip()

    elif text.startswith("```"):
        text = text[3:].strip()

    if text.endswith("```"):
        text = text[:-3].strip()

    first_brace = text.find("{")
    last_brace = text.rfind("}")

    if (
        first_brace != -1
        and last_brace != -1
        and last_brace > first_brace
    ):
        text = text[
            first_brace:last_brace + 1
        ]

    return text.strip()

# ============================================================
# RECORD TOPIC
# ============================================================

def record_topic(topic):

    topic = str(topic).strip()

    if not topic:
        return

    conn = get_db()

    conn.execute("""
        INSERT INTO topics (topic, last_used)
        VALUES (?, ?)

        ON CONFLICT(topic)
        DO UPDATE SET
            last_used = excluded.last_used
    """, (
        topic.lower(),
        datetime.now().isoformat()
    ))

    conn.commit()
    conn.close()

    record_study_day()
# =========================================================
# STATISTICS
# =========================================================

def get_statistics():

    user_id = session.get("user_id")

    if not user_id:
        return {
            "topics_explored": 0,
            "quizzes_completed": 0,
            "accuracy": 0,
            "study_streak": 0
        }

    conn = get_db()

    topics = conn.execute("""
        SELECT COUNT(*) AS count
        FROM topics
        WHERE user_id = ?
    """, (user_id,)).fetchone()["count"]

    quizzes = conn.execute("""
        SELECT COUNT(*) AS count
        FROM quizzes
        WHERE user_id = ?
    """, (user_id,)).fetchone()["count"]

    quiz_data = conn.execute("""
        SELECT
            COALESCE(SUM(score), 0) AS correct,
            COALESCE(SUM(total), 0) AS total
        FROM quizzes
        WHERE user_id = ?
    """, (user_id,)).fetchone()

    conn.close()

    correct = quiz_data["correct"]
    total = quiz_data["total"]

    accuracy = round((correct / total) * 100) if total > 0 else 0

    return {
        "topics_explored": topics,
        "quizzes_completed": quizzes,
        "accuracy": accuracy,
        "study_streak": calculate_streak()
    }

def calculate_streak():

    user_id = session.get("user_id")

    if not user_id:
        return 0

    conn = get_db()

    rows = conn.execute("""
        SELECT study_date
        FROM study_days
        WHERE user_id = ?
        ORDER BY study_date DESC
    """, (
        user_id,
    )).fetchall()

    conn.close()

    if not rows:
        return 0

    dates = [
        datetime.strptime(
            row["study_date"],
            "%Y-%m-%d"
        ).date()
        for row in rows
    ]

    today = date.today()

    if dates[0] == today:
        current = today

    elif dates[0] == today - timedelta(days=1):
        current = today - timedelta(days=1)

    else:
        return 0

    streak = 0

    for study_date in dates:

        if study_date == current:

            streak += 1
            current -= timedelta(days=1)

        elif study_date < current:

            break

    return streak

# =========================================================
# AI HELPERS
# =========================================================

def clean_json_response(result):

    result = result.strip()

    if result.startswith("```json"):
        result = result[7:]

    elif result.startswith("```"):
        result = result[3:]

    if result.endswith("```"):
        result = result[:-3]

    return result.strip()


def generate_ai(prompt, model="gemini-3.5-flash-lite", json_mode=False):

    last_error = None

    for attempt in range(3):

        try:

            print()
            print("================================")
            print("GEMINI REQUEST")
            print("MODEL:", model)
            print("JSON MODE:", json_mode)
            print("ATTEMPT:", attempt + 1)
            print("================================")


            response = client.models.generate_content(
                model=model,
                contents=prompt
            )


            print("GEMINI RESPONSE RECEIVED")


            text = response.text


            if not text:

                raise Exception(
                    "Gemini returned an empty response."
                )


            return text


        except Exception as e:

            last_error = e

            error_text = str(e)

            print()
            print("================================")
            print("GEMINI ERROR")
            print("================================")
            print(type(e).__name__)
            print(error_text)
            print("================================")


            lower_error = error_text.lower()


            # Retry temporary Gemini/server errors

            if (
                "503" in lower_error
                or "unavailable" in lower_error
                or "high demand" in lower_error
                or "429" in lower_error
            ):

                if attempt < 2:

                    print(
                        "Gemini temporarily unavailable."
                    )

                    print(
                        "Retrying..."
                    )

                    time.sleep(2)

                    continue


            break


    raise last_error
# =========================================================
# WAV HELPER
# =========================================================

def pcm_to_wav(
    pcm_data,
    sample_rate=24000,
    channels=1,
    sample_width=2
):

    wav_buffer = io.BytesIO()

    with wave.open(
        wav_buffer,
        "wb"
    ) as wav_file:

        wav_file.setnchannels(
            channels
        )

        wav_file.setsampwidth(
            sample_width
        )

        wav_file.setframerate(
            sample_rate
        )

        wav_file.writeframes(
            pcm_data
        )

    return wav_buffer.getvalue()

# =========================================================
# LOGIN REQUIRED DECORATOR
# =========================================================

def login_required(route_function):

    @wraps(route_function)
    def wrapper(*args, **kwargs):

        if "user_id" not in session:
            return redirect(url_for("login"))

        return route_function(*args, **kwargs)

    return wrapper
# =========================================================
# PAGES
# =========================================================

@app.route("/")
@login_required
def home():

    username = session.get("username")
    email = session.get("email")

    print("========== DASHBOARD ==========")
    print("SESSION:", dict(session))
    print("USERNAME:", username)
    print("EMAIL:", email)

    return render_template(
        "index.html",
        username=username,
        email=email
    )

@app.route("/quiz")
@login_required
def quiz():
    return render_template("quiz.html")


@app.route("/flashcards")
@login_required
def flashcards():
    return render_template("flashcards.html")


@app.route("/explain")
@login_required
def explain():
    return render_template("explain.html")


@app.route("/notes")
@login_required
def notes():
    return render_template("notes.html")


@app.route("/predictor")
@login_required
def predictor():
    return render_template("predictor.html")

@app.route("/planner")
def planner():
    return render_template("planner.html")

# =========================================================
# TEST AI
# =========================================================

@app.route("/test-ai")
def test_ai():

    try:

        response = generate_ai(
            "Say exactly: StudyAI Gemini connection works!",
            "gemini-3.5-flash-lite"
        )

        return response

    except Exception as e:

        return f"AI ERROR: {e}"


# =========================================================
# QUIZ GENERATION
# =========================================================

@app.route(
    "/api/generate-quiz",
    methods=["POST"]
)
def generate_quiz():

    try:

        data = request.get_json() or {}

        topic = data.get(
            "topic",
            ""
        ).strip()

        number = data.get(
            "number",
            5
        )

        difficulty = data.get(
            "difficulty",
            "Medium"
        )

        if not topic:

            return jsonify({
                "error":
                "Please enter a topic."
            }), 400

        record_topic(topic)

        prompt = f"""
You are StudyAI, an AI study assistant
for students.

Create {number} multiple-choice questions
about:

{topic}

Difficulty level:

{difficulty}

For every question provide:

1. The question
2. Four options: A, B, C and D
3. The correct answer
4. A simple explanation

Make the questions educational and
appropriate for students.

Return ONLY valid JSON.

Do NOT use markdown.
Do NOT use ```json.
Do NOT add any text outside the JSON.

Use exactly this format:

{{
    "questions": [
        {{
            "question": "Question here",
            "options": {{
                "A": "Option A",
                "B": "Option B",
                "C": "Option C",
                "D": "Option D"
            }},
            "answer": "A",
            "explanation": "Simple explanation here."
        }}
    ]
}}
"""

        result = generate_ai(
            prompt,
            "gemini-3.5-flash-lite"
        )

        result = clean_json_response(result)

        quiz_data = json.loads(result)

        return jsonify(
            quiz_data
        )

    except json.JSONDecodeError:

        return jsonify({
            "error":
            "Gemini returned an invalid quiz format. Please try again."
        }), 500

    except Exception as e:

        print(
            "QUIZ ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500


# =========================================================
# FLASHCARDS
# =========================================================

@app.route(
    "/api/generate-flashcards",
    methods=["POST"]
)
def generate_flashcards():

    try:

        data = request.get_json() or {}

        topic = data.get(
            "topic",
            ""
        ).strip()

        number = data.get(
            "number",
            5
        )

        if not topic:

            return jsonify({
                "error":
                "Please enter a topic."
            }), 400

        record_topic(topic)

        prompt = f"""
You are StudyAI, an AI study assistant.

Create {number} useful study flashcards
about:

{topic}

Each flashcard must contain:

- A short question or term on the front
- A clear, simple answer on the back

Make them useful for exam revision.

Return ONLY valid JSON.

Do NOT use markdown.
Do NOT use ```json.

Use exactly this format:

{{
    "flashcards": [
        {{
            "front": "Question or term",
            "back": "Simple answer"
        }}
    ]
}}
"""

        result = generate_ai(
            prompt,
            "gemini-3.5-flash-lite"
        )

        result = clean_json_response(result)

        flashcard_data = json.loads(
            result
        )

        return jsonify(
            flashcard_data
        )

    except json.JSONDecodeError:

        return jsonify({
            "error":
            "Gemini returned an invalid flashcard format. Please try again."
        }), 500

    except Exception as e:

        print(
            "FLASHCARD ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500


# =========================================================
# EXPLAIN TOPIC
# =========================================================

@app.route(
    "/api/explain-topic",
    methods=["POST"]
)
def explain_topic():

    try:

        data = request.get_json() or {}

        topic = data.get(
            "topic",
            ""
        ).strip()

        if not topic:

            return jsonify({
                "error":
                "Please enter a topic."
            }), 400

        record_topic(topic)

        prompt = f"""
You are StudyAI, an AI study assistant.

Explain the following topic to a student:

{topic}

Create an English explanation.

The explanation must be:

- Simple
- Easy to understand
- Exam-focused
- Well structured
- Suitable for a student

Include:

1. Simple Explanation
2. How it works
3. Important points
4. One simple example
5. Quick revision summary

Return ONLY valid JSON.

Do NOT use markdown.
Do NOT use ```json.
Do NOT add text outside the JSON.

Use exactly this format:

{{
    "title": "{topic}",
    "simple_explanation":
        "English simple explanation.",
    "how_it_works":
        "English explanation of how it works.",
    "important_points": [
        "Important point 1",
        "Important point 2",
        "Important point 3"
    ],
    "example":
        "English example.",
    "quick_revision":
        "English quick revision summary."
}}
"""

        result = generate_ai(
            prompt,
            "gemini-3.5-flash-lite"
        )

        result = clean_json_response(
            result
        )

        explanation_data = json.loads(
            result
        )

        return jsonify(
            explanation_data
        )

    except json.JSONDecodeError:

        return jsonify({
            "error":
            "Gemini returned an invalid explanation format. Please try again."
        }), 500

    except Exception as e:

        print(
            "EXPLAIN ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500


# =========================================================
# UPLOAD NOTES
# =========================================================

@app.route(
    "/api/upload-notes",
    methods=["POST"]
)
def upload_notes():

    try:

        if "file" not in request.files:

            return jsonify({
                "error":
                "Please select a file."
            }), 400

        file = request.files["file"]

        if file.filename == "":

            return jsonify({
                "error":
                "No file selected."
            }), 400

        filename = file.filename.lower()

        text = ""

        if filename.endswith(".pdf"):

            from PyPDF2 import PdfReader

            reader = PdfReader(file)

            for page in reader.pages:

                page_text = page.extract_text()

                if page_text:

                    text += page_text + "\n"

        elif filename.endswith(".docx"):

            from docx import Document

            document = Document(file)

            for paragraph in document.paragraphs:

                if paragraph.text.strip():

                    text += paragraph.text + "\n"

        else:

            return jsonify({
                "error":
                "Only PDF and DOCX files are supported."
            }), 400

        if not text.strip():

            return jsonify({
                "error":
                "I couldn't extract any text from this file."
            }), 400

        app.config["UPLOADED_NOTES"] = text

        app.config["UPLOADED_FILENAME"] = (
            file.filename
        )

        record_study_day()

        return jsonify({

            "success": True,

            "message":
                f"'{file.filename}' uploaded successfully! Your notes are ready.",

            "characters":
                len(text)
        })

    except Exception as e:

        print(
            "NOTES UPLOAD ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500


# =========================================================
# ASK NOTES
# =========================================================

@app.route(
    "/api/ask-notes",
    methods=["POST"]
)
def ask_notes():

    try:

        data = request.get_json() or {}

        question = data.get(
            "question",
            ""
        ).strip()

        if not question:

            return jsonify({
                "error":
                "Please enter a question."
            }), 400

        notes = app.config.get(
            "UPLOADED_NOTES",
            ""
        )

        if not notes:

            return jsonify({
                "error":
                "Please upload your notes first."
            }), 400

        prompt = f"""
You are StudyAI, an AI study assistant.

The student uploaded study notes.

Answer the student's question using
the uploaded notes as the main source.

IMPORTANT RULES:

1. Use the uploaded notes.
2. Do not make up information.
3. If the answer is not present in the notes,
   say that it could not be found in the uploaded notes.
4. Explain the answer in simple language.
5. Keep the answer useful for a student.

STUDENT QUESTION:

{question}

UPLOADED NOTES:

{notes}
"""

        answer = generate_ai(
            prompt,
            "gemini-3.5-flash-lite"
        )

        record_study_day()

        return jsonify({
            "answer": answer
        })

    except Exception as e:

        print(
            "NOTES AI ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500


# =========================================================
# EXAM TOPIC PREDICTOR
# =========================================================

@app.route(
    "/api/predict-topics",
    methods=["POST"]
)
def predict_topics():

    try:

        if "papers" not in request.files:

            return jsonify({
                "error":
                "Please upload at least one question paper."
            }), 400

        files = request.files.getlist(
            "papers"
        )

        if not files:

            return jsonify({
                "error":
                "No question papers were uploaded."
            }), 400

        all_text = ""

        for file in files:

            if not file.filename:
                continue

            filename = file.filename.lower()

            if filename.endswith(".pdf"):

                from PyPDF2 import PdfReader

                reader = PdfReader(file)

                for page in reader.pages:

                    page_text = page.extract_text()

                    if page_text:

                        all_text += (
                            "\n" +
                            page_text +
                            "\n"
                        )

            elif filename.endswith(".docx"):

                from docx import Document

                document = Document(file)

                for paragraph in document.paragraphs:

                    if paragraph.text.strip():

                        all_text += (
                            "\n" +
                            paragraph.text +
                            "\n"
                        )

        if not all_text.strip():

            return jsonify({
                "error":
                "I couldn't extract text from the question papers."
            }), 400

        prompt = f"""
You are StudyAI, an AI exam prediction assistant.

Analyze the previous question papers below.

Identify:

1. Frequently repeated topics.
2. Topics appearing across multiple papers.
3. Topics likely to be important for the upcoming exam.
4. Important question patterns.
5. Useful study advice.

Do NOT claim that a topic is guaranteed to appear.

Rank topics from most important to least important.

Return ONLY valid JSON.

Do NOT use markdown.
Do NOT use ```json.
Do NOT add text outside JSON.

Use exactly this format:

{{
    "prediction_summary":
        "Short summary of the exam pattern.",

    "topics": [
        {{
            "topic": "Topic name",
            "priority": "HIGH",
            "reason":
                "Why this topic is important based on the papers."
        }}
    ],

    "study_advice": [
        "Study advice 1",
        "Study advice 2",
        "Study advice 3"
    ]
}}

PREVIOUS QUESTION PAPERS:

{all_text}
"""

        result = generate_ai(
            prompt,
            "gemini-3.5-flash-lite"
        )

        result = clean_json_response(
            result
        )

        prediction_data = json.loads(
            result
        )

        record_study_day()

        return jsonify(
            prediction_data
        )

    except json.JSONDecodeError:

        return jsonify({
            "error":
            "Gemini returned an invalid prediction format. Please try again."
        }), 500

    except Exception as e:

        print(
            "PREDICTOR ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500


# =========================================================
# TELUGU TRANSLATION
# =========================================================

@app.route(
    "/api/translate-telugu",
    methods=["POST"]
)
def translate_telugu():

    try:

        data = request.get_json() or {}

        text = data.get(
            "text",
            ""
        ).strip()

        if not text:

            return jsonify({
                "error":
                "No text to translate."
            }), 400

        prompt = f"""
Translate the following study explanation
into natural, easy-to-understand Telugu.

IMPORTANT:

- Translate ALL of the content.
- Do not summarize.
- Do not add information.
- Keep formulas unchanged.
- Keep numbers unchanged.
- Keep scientific terms understandable.
- Use Telugu script.
- Return ONLY the Telugu translation.
- Do NOT use markdown.

TEXT:

{text}
"""

        translated = generate_ai(
            prompt,
            "gemini-2.5-flash-preview-tts"
        )

        return jsonify({

            "translation":
                translated.strip()

        })

    except Exception as e:

        print(
            "TELUGU TRANSLATION ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500


# ============================================================
# FAST TELUGU VOICE
# English → Telugu → Audio
# ============================================================

@app.route(
    "/api/fast-telugu-voice",
    methods=["POST"]
)
def fast_telugu_voice():

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "error": "No data received."
            }), 400

        english_text = data.get(
            "text",
            ""
        ).strip()

        if not english_text:
            return jsonify({
                "error": "No explanation received."
            }), 400

        # ====================================================
        # STEP 1 — ENGLISH → TELUGU
        # ====================================================

        translation_prompt = f"""
Translate the following educational explanation
from English to natural, easy-to-understand Telugu.

IMPORTANT:

- Translate the complete explanation.
- Do not summarize.
- Do not add extra information.
- Keep formulas, numbers and symbols unchanged.
- Keep important scientific and technical terms understandable.
- Use Telugu script.
- Return ONLY the Telugu translation.
- Do NOT use markdown.

English explanation:

{english_text}
"""

        translation_response = client.models.generate_content(

            model="gemini-3.6-flash",

            contents=translation_prompt
        )

        telugu_text = (
            translation_response.text or ""
        ).strip()

        if not telugu_text:

            return jsonify({
                "error":
                "Telugu translation was empty."
            }), 500

        print(
            "TELUGU TRANSLATION GENERATED"
        )

        # ====================================================
        # STEP 2 — TELUGU → AUDIO
        # ====================================================

        audio_response = client.models.generate_content(

            model="gemini-3.1-flash-tts-preview",

            contents=telugu_text,

            config=types.GenerateContentConfig(

                response_modalities=[
                    "AUDIO"
                ],

                speech_config=types.SpeechConfig(

                    language_code="te-IN",

                    voice_config=types.VoiceConfig(

                        prebuilt_voice_config=
                        types.PrebuiltVoiceConfig(

                            voice_name="Kore"
                        )
                    )
                )
            )
        )

        # ====================================================
        # FIND AUDIO DATA
        # ====================================================

        audio_data = None

        for candidate in audio_response.candidates:

            if not candidate.content:
                continue

            for part in candidate.content.parts:

                if (
                    part.inline_data
                    and part.inline_data.data
                ):

                    audio_data = (
                        part.inline_data.data
                    )

                    break

            if audio_data:
                break

        if not audio_data:

            return jsonify({
                "error":
                "No audio returned by Gemini."
            }), 500

        print(
            "TELUGU AUDIO GENERATED"
        )

        # ====================================================
        # STEP 3 — PCM → WAV
        # ====================================================

        import wave
        import io

        wav_buffer = io.BytesIO()

        with wave.open(
            wav_buffer,
            "wb"
        ) as wav_file:

            wav_file.setnchannels(1)

            wav_file.setsampwidth(2)

            wav_file.setframerate(24000)

            wav_file.writeframes(
                audio_data
            )

        wav_bytes = (
            wav_buffer.getvalue()
        )

        # ====================================================
        # STEP 4 — WAV → BASE64
        # ====================================================

        audio_base64 = (
            base64
            .b64encode(wav_bytes)
            .decode("utf-8")
        )

        # ====================================================
        # STEP 5 — RETURN
        # ====================================================

        return jsonify({

            "success": True,

            "audio":
                audio_base64,

            "translation":
                telugu_text

        })

    except Exception as e:

        print(
            "FAST TELUGU VOICE ERROR:",
            e
        )

        return jsonify({

            "error":
                str(e)

        }), 500


# =========================================================
# STUDY STATISTICS API
# =========================================================

@app.route(
    "/api/stats"
)
def stats():

    try:

        return jsonify(
            get_statistics()
        )

    except Exception as e:

        print(
            "STATS ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500


# =========================================================
# RECORD QUIZ
# =========================================================

@app.route(
    "/api/record-quiz",
    methods=["POST"]
)
@login_required
def record_quiz():

    try:

        data = request.get_json() or {}

        topic = data.get(
            "topic",
            "Unknown Topic"
        ).strip()

        score = int(
            data.get(
                "score",
                0
            )
        )

        total = int(
            data.get(
                "total",
                0
            )
        )

        if total <= 0:
            return jsonify({
                "error": "Invalid quiz total."
            }), 400

        if score < 0 or score > total:
            return jsonify({
                "error": "Invalid quiz score."
            }), 400

        conn = get_db()

        # Record the completed quiz for this user
        conn.execute("""
    INSERT INTO quizzes
    (
        user_id,
        topic,
        score,
        total,
        completed_at
    )
    VALUES (?, ?, ?, ?, ?)
""", (
    session.get("user_id"),
    topic,
    score,
    total,
    datetime.now().isoformat()
))

        # Record today's study activity for this user
        conn.execute("""
    INSERT INTO study_days
    (user_id, study_date)
    VALUES (?, ?)
""", (
    session.get("user_id"),
    date.today().isoformat()
))
        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "stats": get_statistics()
        })

    except ValueError:

        return jsonify({
            "error":
                "Score and total must be numbers."
        }), 400

    except Exception as e:

        print(
            "RECORD QUIZ ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500
# =========================================================
# SIGNUP
# =========================================================

@app.route("/signup", methods=["GET", "POST"])
def signup():

    if request.method == "GET":
        return render_template("signup.html")

    data = request.get_json() or {}

    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({
            "error": "Please fill in all fields."
        }), 400

    if len(password) < 6:
        return jsonify({
            "error": "Password must be at least 6 characters."
        }), 400

    hashed_password = generate_password_hash(password)

    try:

        conn = get_db()

        conn.execute("""
            INSERT INTO users
            (username, email, password, created_at)
            VALUES (?, ?, ?, ?)
        """, (
            username,
            email,
            hashed_password,
            datetime.now().isoformat()
        ))

        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "message": "Account created successfully!"
        })

    except sqlite3.IntegrityError:

        return jsonify({
            "error": "Username or email already exists."
        }), 409

    except Exception as e:

        print("SIGNUP ERROR:", e)

        return jsonify({
            "error": str(e)
        }), 500
# =========================================================
# LOGIN
# =========================================================

@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "GET":
        return render_template("login.html")

    data = request.get_json() or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({
            "error": "Please enter email and password."
        }), 400

    conn = get_db()

    user = conn.execute("""
        SELECT id, username, email, password
        FROM users
        WHERE email = ?
    """, (email,)).fetchone()

    conn.close()

    if not user:
        return jsonify({
            "error": "Invalid email or password."
        }), 401

    if not check_password_hash(
        user["password"],
        password
    ):
        return jsonify({
            "error": "Invalid email or password."
        }), 401

    # ==============================
    # SAVE LOGIN INFORMATION
    # ==============================

    session.clear()

    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["email"] = user["email"]

    print("LOGIN SUCCESS")
    print("USER ID:", session["user_id"])
    print("USERNAME:", session["username"])
    print("SESSION:", dict(session))

    return jsonify({
        "success": True,
        "message": "Login successful!",
        "username": user["username"]
    })
# =========================================================
# LOGOUT
# =========================================================

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))
@app.context_processor
def inject_user():
    return {
        "current_user": current_user
    }

class User(UserMixin):

    def __init__(
        self,
        id,
        username,
        email,
        password
    ):
        self.id = id
        self.username = username
        self.email = email
        self.password = password
       
@login_manager.user_loader
def load_user(user_id):

    conn = get_db()

    user = conn.execute(
        """
        SELECT id, username, email, password
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    ).fetchone()

    conn.close()

    if user is None:
        return None

    return User(
        user["id"],
        user["username"],
        user["email"],
        user["password"]
    )
# ============================================================
# AI STUDY PLANNER
# ============================================================

@app.route(
    "/api/generate-study-plan",
    methods=["POST"]
)
def generate_study_plan():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        subject = str(
            data.get(
                "subject",
                ""
            )
        ).strip()

        topics_text = str(
            data.get(
                "topics",
                ""
            )
        ).strip()

        exam_date = str(
            data.get(
                "exam_date",
                ""
            )
        ).strip()

        try:

            hours_per_day = int(
                data.get(
                    "hours_per_day",
                    2
                )
            )

        except Exception:

            hours_per_day = 2


        # ----------------------------------------------------
        # VALIDATION
        # ----------------------------------------------------

        if not subject:

            return jsonify({
                "error":
                "Please enter the subject."
            }), 400


        if not topics_text:

            return jsonify({
                "error":
                "Please enter the topics."
            }), 400


        if not exam_date:

            return jsonify({
                "error":
                "Please select the exam date."
            }), 400


        hours_per_day = max(
            1,
            min(hours_per_day, 8)
        )


        # ----------------------------------------------------
        # CALCULATE DAYS
        # ----------------------------------------------------

        try:

            exam = datetime.strptime(
                exam_date,
                "%Y-%m-%d"
            ).date()

        except ValueError:

            return jsonify({
                "error":
                "Invalid exam date."
            }), 400


        today = date.today()

        days_available = (
            exam - today
        ).days


        if days_available <= 0:

            return jsonify({
                "error":
                "Exam date must be in the future."
            }), 400


        # Keep a little revision time before exam

        study_days = max(
            1,
            days_available
        )


        # ----------------------------------------------------
        # TOPICS
        # ----------------------------------------------------

        topics = [
            topic.strip()
            for topic in topics_text.split(",")
            if topic.strip()
        ]


        if not topics:

            return jsonify({
                "error":
                "Please enter at least one topic."
            }), 400


        topics_for_ai = ", ".join(
            topics
        )


        # ----------------------------------------------------
        # AI PROMPT
        # ----------------------------------------------------

        prompt = f"""
You are StudyAI, an intelligent exam study planner.

Create a realistic daily study plan for a student.

SUBJECT:
{subject}

MAIN TOPICS:
{topics_for_ai}

EXAM DATE:
{exam_date}

TODAY:
{today.isoformat()}

NUMBER OF DAYS AVAILABLE:
{study_days}

STUDY HOURS PER DAY:
{hours_per_day}

IMPORTANT REQUIREMENTS:

1. Create exactly {study_days} daily study entries.

2. The plan must cover the provided main topics.

3. Divide large topics across multiple days when necessary.

4. Every day must contain:
   - day
   - date
   - main_topic
   - focused_topic
   - amount
   - tasks

5. "main_topic" means the larger chapter or subject area.

6. "focused_topic" means the specific concept the student
   should concentrate on that day.

7. "amount" must describe how much the student should study
   that day, considering {hours_per_day} hours available.

8. "tasks" should contain short study activities.

9. Near the exam, include revision and practice instead
   of introducing too many new topics.

10. Make the plan realistic and manageable.

11. Do not invent topics that were not provided unless a small
    revision/practice task is necessary.

12. Do not say that any topic is guaranteed to appear in the exam.

13. Return ONLY valid JSON.

RETURN EXACTLY THIS STRUCTURE:

{{
    "subject": "{subject}",
    "exam_date": "{exam_date}",
    "days_available": {study_days},
    "hours_per_day": {hours_per_day},

    "daily_plan": [

        {{
            "day": 1,
            "date": "{today.isoformat()}",
            "main_topic": "Main topic",
            "focused_topic": "Specific focused concept",
            "amount": "2 hours",
            "tasks": [
                "Study the concept",
                "Make short notes",
                "Practice questions"
            ]
        }}

    ]
}}

Make sure every daily_plan entry has all six fields.

Return JSON only.
"""


        print(
            "GENERATING STUDY PLAN:",
            subject,
            "|",
            topics_for_ai,
            "|",
            exam_date,
            "|",
            study_days,
            "days"
        )


        # ----------------------------------------------------
        # GENERATE AI RESPONSE
        # ----------------------------------------------------

        result = generate_ai(
            prompt,
            "gemini-3.5-flash-lite",
            json_mode=True
        )


        result = clean_json_response(
            result
        )


        # ----------------------------------------------------
        # PARSE JSON
        # ----------------------------------------------------

        try:

            plan_data = json.loads(
                result
            )

        except json.JSONDecodeError as error:

            print(
                "STUDY PLAN JSON ERROR:",
                error
            )

            print(
                "RAW STUDY PLAN:"
            )

            print(
                result
            )

            return jsonify({
                "error":
                "AI returned invalid study plan JSON."
            }), 500


        # ----------------------------------------------------
        # VALIDATE
        # ----------------------------------------------------

        if not isinstance(
            plan_data,
            dict
        ):

            return jsonify({
                "error":
                "Study plan response is not an object."
            }), 500


        daily_plan = plan_data.get(
            "daily_plan"
        )


        if not isinstance(
            daily_plan,
            list
        ):

            return jsonify({
                "error":
                "AI did not return a daily_plan array."
            }), 500


        if not daily_plan:

            return jsonify({
                "error":
                "AI returned an empty daily plan."
            }), 500


        # ----------------------------------------------------
        # CLEAN DAILY ENTRIES
        # ----------------------------------------------------

        cleaned_plan = []


        for index, day_plan in enumerate(
            daily_plan,
            start=1
        ):

            if not isinstance(
                day_plan,
                dict
            ):

                continue


            cleaned_plan.append({

                "day":
                    day_plan.get(
                        "day",
                        index
                    ),

                "date":
                    day_plan.get(
                        "date",
                        ""
                    ),

                "main_topic":
                    str(
                        day_plan.get(
                            "main_topic",
                            ""
                        )
                    ).strip(),

                "focused_topic":
                    str(
                        day_plan.get(
                            "focused_topic",
                            ""
                        )
                    ).strip(),

                "amount":
                    str(
                        day_plan.get(
                            "amount",
                            f"{hours_per_day} hours"
                        )
                    ).strip(),

                "tasks":
                    day_plan.get(
                        "tasks",
                        []
                    )

            })


        if not cleaned_plan:

            return jsonify({
                "error":
                "No valid daily study plan was returned."
            }), 500


        # ----------------------------------------------------
        # RECORD STUDY
        # ----------------------------------------------------

        record_study_day()

        record_topic(
            subject
        )


        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return jsonify({

            "success": True,

            "subject":
                subject,

            "exam_date":
                exam_date,

            "days_available":
                study_days,

            "hours_per_day":
                hours_per_day,

            "daily_plan":
                cleaned_plan

        }), 200


    except Exception as error:

        print(
            "STUDY PLANNER ERROR:",
            str(error)
        )

        return jsonify({

            "error":
                str(error)

        }), 500
# =========================================================
# INITIALIZE DATABASE
# =========================================================

init_database()


#=========================================
# RUN APP
# =========================================================

init_database()

if __name__ == "__main__":
    app.run(debug=False)