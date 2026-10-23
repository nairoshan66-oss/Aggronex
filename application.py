from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
import sqlite3
import os
import requests
import random
import time
from werkzeug.security import generate_password_hash, check_password_hash
from flask_mail import Mail, Message
from PIL import Image
import numpy as np

# =========================================================
# FLASK APP CONFIGURATION
# =========================================================

app = Flask(__name__)

app.secret_key = os.environ.get(
    "SECRET_KEY",
    "agronex_secret_key_change_this"
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "db.sqlite3")


# =========================================================
# DATABASE FUNCTIONS
# =========================================================

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


# Create database/table automatically
init_db()


# =========================================================
# EMAIL CONFIGURATION
# =========================================================

app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True

# Put your email settings in environment variables.
# Do NOT put your real Gmail password directly in this file.
app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME", "")
app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD", "")

mail = Mail(app)


# =========================================================
# GOOGLE CLIENT ID
# =========================================================

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


# =========================================================
# OPENWEATHER CONFIGURATION
# =========================================================

API_KEY = os.environ.get("OPENWEATHER_API_KEY", "")

CITY = "Ahmedabad"


# =========================================================
# HOME
# =========================================================

@app.route("/")
def home():
    return render_template("index.html")


# =========================================================
# LOGIN
# =========================================================

@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":

        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if not email or not password:
            flash("Please enter email and password.")
            return redirect(url_for("login"))

        conn = get_db()

        user = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()

        conn.close()

        if user and check_password_hash(user["password"], password):

            session["user"] = user["name"]
            session["email"] = user["email"]

            return redirect(url_for("dashboard"))

        else:

            flash("Invalid email or password!")
            return redirect(url_for("login"))

    return render_template(
        "login.html",
        google_client_id=GOOGLE_CLIENT_ID
    )


# =========================================================
# REGISTER
# =========================================================

@app.route("/register", methods=["GET", "POST"])
def register():

    if request.method == "POST":

        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if not name or not email or not password:

            flash("Please fill all fields.")
            return redirect(url_for("register"))

        conn = get_db()

        existing_user = conn.execute(
            "SELECT id FROM users WHERE email = ?",
            (email,)
        ).fetchone()

        if existing_user:

            conn.close()

            flash("Email already exists!")
            return redirect(url_for("register"))

        hashed_password = generate_password_hash(password)

        conn.execute(
            """
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
            """,
            (name, email, hashed_password)
        )

        conn.commit()
        conn.close()

        flash("Registration successful! Please login.")

        return redirect(url_for("login"))

    return render_template("register.html")


# =========================================================
# FORGOT PASSWORD
# =========================================================

@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():

    if request.method == "POST":

        email = request.form.get("email", "").strip().lower()

        conn = get_db()

        user = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()

        conn.close()

        if not user:

            flash(
                "No account found with this email.",
                "forgot_error"
            )

            return redirect(url_for("forgot_password"))

        # Generate 6 digit OTP
        otp = str(random.randint(100000, 999999))

        # Store OTP and expiry in session
        session["reset_email"] = email
        session["otp"] = otp
        session["otp_expiry"] = time.time() + 300

        try:

            # Email configuration must be available
            if not app.config["MAIL_USERNAME"]:

                flash(
                    "Email service is not configured. "
                    "Please contact the administrator."
                )

                return redirect(url_for("forgot_password"))

            msg = Message(
                "AgroNex Password Reset OTP",
                sender=app.config["MAIL_USERNAME"],
                recipients=[email]
            )

            msg.body = (
                "Your AgroNex password reset OTP is: "
                + otp
                + "\n\n"
                "This OTP is valid for 5 minutes."
            )

            mail.send(msg)

        except Exception as e:

            print("MAIL ERROR:", e)

            flash(
                "Email service failed. Please try again later."
            )

            return redirect(url_for("forgot_password"))

        flash("OTP sent to your email.")

        return redirect(url_for("verify_otp"))

    return render_template("forgot_password.html")


# =========================================================
# VERIFY OTP
# =========================================================

@app.route("/verify-otp", methods=["GET", "POST"])
def verify_otp():

    if request.method == "POST":

        entered_otp = request.form.get("otp", "").strip()

        saved_otp = session.get("otp")
        expiry = session.get("otp_expiry")

        # Check OTP expiry
        if not expiry or time.time() > expiry:

            session.pop("otp", None)
            session.pop("otp_expiry", None)

            flash(
                "OTP has expired. Please request a new OTP.",
                "forgot_error"
            )

            return redirect(url_for("forgot_password"))

        # Check OTP
        if entered_otp == saved_otp:

            session["otp_verified"] = True

            session.pop("otp", None)
            session.pop("otp_expiry", None)

            return redirect(url_for("reset_password"))

        flash("Invalid OTP", "forgot_error")

    return render_template("verify_otp.html")


# =========================================================
# RESET PASSWORD
# =========================================================

@app.route("/reset-password", methods=["GET", "POST"])
def reset_password():

    if "reset_email" not in session:
        return redirect(url_for("login"))

    if not session.get("otp_verified"):
        return redirect(url_for("forgot_password"))

    if request.method == "POST":

        new_password = request.form.get("password", "")

        if not new_password:

            flash("Please enter a new password.")
            return redirect(url_for("reset_password"))

        hashed_password = generate_password_hash(new_password)

        conn = get_db()

        conn.execute(
            """
            UPDATE users
            SET password = ?
            WHERE email = ?
            """,
            (
                hashed_password,
                session["reset_email"]
            )
        )

        conn.commit()
        conn.close()

        # Clear reset session
        session.pop("reset_email", None)
        session.pop("otp_verified", None)

        flash("Password updated successfully!")

        return redirect(url_for("login"))

    return render_template("reset_password.html")


# =========================================================
# GOOGLE LOGIN
# =========================================================

@app.route("/google-login", methods=["POST"])
def google_login():

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "status": "error",
                "message": "No data received."
            }), 400

        token = data.get("credential")

        if not token:
            return jsonify({
                "status": "error",
                "message": "Google credential missing."
            }), 400

        response = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": token},
            timeout=10
        )

        if response.status_code != 200:

            return jsonify({
                "status": "error",
                "message": "Invalid Google token."
            }), 401

        user_info = response.json()

        google_email = user_info.get("email")
        google_name = user_info.get("name", "Google User")

        if not google_email:

            return jsonify({
                "status": "error",
                "message": "Google email not found."
            }), 400

        google_email = google_email.lower()

        conn = get_db()

        user = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (google_email,)
        ).fetchone()

        # Create account if it doesn't exist
        if not user:

            random_password = generate_password_hash(
                str(random.random())
            )

            conn.execute(
                """
                INSERT INTO users (name, email, password)
                VALUES (?, ?, ?)
                """,
                (
                    google_name,
                    google_email,
                    random_password
                )
            )

            conn.commit()

            user = conn.execute(
                "SELECT * FROM users WHERE email = ?",
                (google_email,)
            ).fetchone()

        conn.close()

        session["user"] = user["name"]
        session["email"] = user["email"]

        return jsonify({
            "status": "success"
        })

    except Exception as e:

        print("GOOGLE LOGIN ERROR:", e)

        return jsonify({
            "status": "error",
            "message": "Google login failed."
        }), 500


# =========================================================
# DASHBOARD
# =========================================================

@app.route("/dashboard")
def dashboard():

    if "user" not in session:

        flash("You must login first!")

        return redirect(url_for("login"))

    return render_template("dashboard.html")


# =========================================================
# LOGOUT
# =========================================================

@app.route("/logout")
def logout():

    session.clear()

    flash(
        "You have been logged out successfully!",
        "logout"
    )

    return redirect(url_for("home"))


# =========================================================
# ABOUT
# =========================================================

@app.route("/about")
def about():

    return render_template("about.html")


# =========================================================
# CONTACT
# =========================================================

@app.route("/contact")
def contact():

    return render_template("contact.html")


# =========================================================
# LIVE WEATHER
# =========================================================

@app.route("/live-data")
def live_data():

    lat = request.args.get("lat")
    lon = request.args.get("lon")

    if not API_KEY:

        return jsonify({
            "temperature": "--",
            "humidity": "--",
            "wind": "--",
            "error": "OpenWeather API key is not configured."
        })

    try:

        if lat and lon:

            url = (
                "https://api.openweathermap.org/data/2.5/weather"
                f"?lat={lat}"
                f"&lon={lon}"
                f"&appid={API_KEY}"
                "&units=metric"
            )

        else:

            url = (
                "https://api.openweathermap.org/data/2.5/weather"
                f"?q={CITY}"
                f"&appid={API_KEY}"
                "&units=metric"
            )

        response = requests.get(
            url,
            timeout=10
        )

        data = response.json()

        print("API RESPONSE:", data)

        if "main" not in data:

            return jsonify({
                "temperature": "--",
                "humidity": "--",
                "wind": "--",
                "error": data
            })

        temperature = data["main"]["temp"]
        humidity = data["main"]["humidity"]

        wind = data.get("wind", {}).get(
            "speed",
            "--"
        )

        return jsonify({
            "temperature": temperature,
            "humidity": humidity,
            "wind": wind
        })

    except Exception as e:

        print("WEATHER ERROR:", e)

        return jsonify({
            "temperature": "--",
            "humidity": "--",
            "wind": "--",
            "error": str(e)
        })


# =========================================================
# SOIL IMAGE ANALYSIS
# =========================================================

@app.route("/analyze-image", methods=["POST"])
def analyze_image():

    file = request.files.get("image")

    if not file:

        return jsonify({
            "error": "No image uploaded"
        }), 400

    try:

        img = Image.open(file)

        img = img.convert("RGB")

        img = img.resize((100, 100))

        arr = np.array(img)

        avg_color = arr.mean()

        # Simple demo soil classification
        if avg_color > 150:

            soil = "Sandy"
            crop = "Groundnut, Millet"
            fertilizer = "Compost"

        elif avg_color < 80:

            soil = "Clay"
            crop = "Rice, Wheat"
            fertilizer = "Organic Matter"

        else:

            soil = "Loamy"
            crop = "Vegetables, Wheat"
            fertilizer = "NPK"

        return jsonify({
            "soil": soil,
            "crop": crop,
            "fertilizer": fertilizer
        })

    except Exception as e:

        print("IMAGE ANALYSIS ERROR:", e)

        return jsonify({
            "error": "Invalid image or image processing failed."
        }), 400


# =========================================================
# RUN APPLICATION
# =========================================================

if __name__ == "__main__":

    print("=" * 50)
    print("AgroNex Flask Application")
    print("=" * 50)
    print("Database:", DATABASE)
    print("Starting server...")
    print("Open: http://127.0.0.1:5000")
    print("=" * 50)

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )