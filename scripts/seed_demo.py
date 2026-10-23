"""Load demo conditions so every screen has realistic data (run once after setup)."""
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import alerts, db  # noqa: E402
from app.assistant import respond  # noqa: E402

db.init_db()
today = date.today()
# Live weather feed (IMD-style district alerts)
alerts.set_weather("Rudraprayag", "Orange", 85)
alerts.set_weather("Chamoli", "Yellow", 40)
alerts.set_weather("Uttarkashi", "None", 6)
# Demo subscriptions (consent given)
for phone, lang, shrine in [("9876543210", "hi", "kedarnath"), ("9811122233", "en", "kedarnath"),
                            ("9822233344", "en", "badrinath"), ("9833344455", "hi", "kedarnath"),
                            ("9844455566", "en", "gangotri")]:
    alerts.subscribe(phone, lang, shrine, today.isoformat(), (today + timedelta(6)).isoformat(), 3, True)
# Road status entered by district control rooms
alerts.set_road_status("chamoli_joshimath", "Restricted", "one-way traffic at a sinking zone", "Ongoing", "seed")
# Some traffic for the analytics panel
for q in ["Is Kedarnath crowded this week?", "How do I register for the yatra?", "Is the road to Badrinath open?",
          "केदारनाथ में कल कितनी भीड़ होगी?", "What should I carry?", "My mother is 64, is screening needed?",
          "How to book helicopter for Kedarnath?", "बारिश में यात्रा सुरक्षित है क्या?", "Which day has less crowd at Gangotri?",
          "Can I pay by UPI?", "How far is the trek from Gaurikund?", "हेमकुंड साहिब कैसे पहुंचें?"]:
    respond(q)
print("Demo data loaded.")
