import streamlit as st
import json
import os
import calendar
from datetime import date, timedelta
import pandas as pd

# ─── קבועים ───────────────────────────────────────────────
DATA_FILE        = os.path.join(os.path.dirname(__file__), "data", "data.json")
TOTAL_SOLDIERS   = 30
MAX_ON_LEAVE     = 18
MIN_ON_DUTY      = 12
DEPLOYMENT_START = date(2026, 4, 26)
DEPLOYMENT_END   = date(2026, 6, 26)

# תחילת הרוטינה (מחזוריות 15 ימים): 30.04.2026
ROUTINE_START    = date(2026, 4, 30)
CYCLE_LENGTH     = 15  # יום 0=משותף, 1-6=א'בית/ב'בסיס, 7-14=א'בסיס/ב'בית

DAYS_HEB = {
    "Sun": "ראשון", "Mon": "שני", "Tue": "שלישי",
    "Wed": "רביעי", "Thu": "חמישי", "Fri": "שישי", "Sat": "שבת",
}

# ─── הגדרות עמוד ──────────────────────────────────────────
st.set_page_config(
    page_title="מערכת ניהול בקשות יציאה",
    page_icon="🪖",
    layout="wide",
)

RTL_CSS = """
<style>
    html, body, [class*="css"] { direction: rtl; text-align: right; }
    .main .block-container { direction: rtl; text-align: right; }
    h1,h2,h3,h4,h5,h6,p,span,div,label { direction: rtl; text-align: right; }
    [data-testid="stSidebar"] { direction: rtl; text-align: right; overflow: hidden !important; }
    [data-testid="stSidebarUserContent"] { white-space: nowrap !important; overflow: hidden !important; }
    [data-testid="stSidebar"][aria-expanded="false"] [data-testid="stSidebarUserContent"] { display: none !important; opacity: 0 !important; }
    [data-testid="stSidebarCollapsedControl"] { position: absolute !important; top: 15px !important; right: 15px !important; left: auto !important; z-index: 9999 !important; opacity: 1 !important; background: #1f3a5f !important; border-radius: 8px !important; padding: 4px !important; }
    [data-testid="stSidebarCollapsedControl"] svg { fill: white !important; }
    #MainMenu { display: none !important; }
    .stAppDeployButton { display: none !important; }
    [data-testid="stHeader"] { background: transparent !important; }
    [data-testid="stHeader"] > div:first-child { display: none !important; }
    [data-testid="stDataFrame"] th, [data-testid="stDataFrame"] td { text-align: right !important; direction: rtl; }
    [data-testid="stExpander"] * { direction: rtl; text-align: right; }
    [data-testid="stExpanderToggleIcon"] { float: left; }
</style>
"""


# ──────────────────────────────────────────────────────────
# פונקציות נתונים
# ──────────────────────────────────────────────────────────
def load_data():
    if not os.path.exists(DATA_FILE):
        return {"requests": [], "soldiers": [], "rounds": [], "swaps": []}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    for key in ("soldiers", "rounds", "swaps"):
        if key not in data:
            data[key] = []
    return data


def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


def get_next_id(data):
    ids = [r["id"] for r in data["requests"]] + [s.get("id", 0) for s in data["swaps"]]
    return max(ids, default=0) + 1


# ── ספירת ימי יציאה מאושרים ──
def count_on_leave_per_day(data, start_date, end_date):
    approved = [r for r in data["requests"] if r["status"] == "Approved"]
    day_counts = {}
    current = start_date
    while current <= end_date:
        count = sum(
            1 for r in approved
            if date.fromisoformat(r["start_date"]) <= current <= date.fromisoformat(r["end_date"])
        )
        day_counts[current] = count
        current += timedelta(days=1)
    return day_counts


def days_used_by_soldier(data, soldier_name):
    total = 0
    for r in data["requests"]:
        if r["soldier_name"] == soldier_name and r["status"] == "Approved":
            rs = date.fromisoformat(r["start_date"])
            re = date.fromisoformat(r["end_date"])
            total += (re - rs).days + 1
    return total


def days_denied_by_soldier(data, soldier_name):
    total = 0
    for r in data["requests"]:
        if r["soldier_name"] == soldier_name and r["status"] == "Denied":
            rs = date.fromisoformat(r["start_date"])
            re = date.fromisoformat(r["end_date"])
            total += (re - rs).days + 1
    return total


def check_overlap_warning(data, soldier_name, start_d, end_d):
    approved_others = [
        r for r in data["requests"]
        if r["status"] == "Approved" and r["soldier_name"] != soldier_name
    ]
    overloaded = []
    current = start_d
    while current <= end_d:
        if sum(
            1 for r in approved_others
            if date.fromisoformat(r["start_date"]) <= current <= date.fromisoformat(r["end_date"])
        ) >= MAX_ON_LEAVE:
            overloaded.append(current)
        current += timedelta(days=1)
    return overloaded


def countdown_values():
    today = date.today()
    if today < DEPLOYMENT_START:
        return "ימים לתחילת התעסוקה", (DEPLOYMENT_START - today).days
    elif today <= DEPLOYMENT_END:
        return "ימים לסיום התעסוקה", (DEPLOYMENT_END - today).days
    else:
        return "התעסוקה הסתיימה", 0


# ── לוגיקת סבבים ──
def get_approved_round(data, soldier_name):
    """מחזיר 'א' / 'ב' אם יש לחייל סבב מאושר, אחרת None."""
    approved = [
        r for r in data["rounds"]
        if r["soldier_name"] == soldier_name and r["status"] == "Approved"
    ]
    return approved[-1]["round"] if approved else None


def get_pending_round(data, soldier_name):
    pending = [
        r for r in data["rounds"]
        if r["soldier_name"] == soldier_name and r["status"] == "Pending"
    ]
    return pending[-1]["round"] if pending else None


def day_type_by_round(d, round_letter):
    """
    לוגיקת מחזוריות 15 ימים החל מ-ROUTINE_START (30.04.2026).

    מבנה המחזור:
      יום  0          →  יום משותף – כולם בבסיס 🛡️
      ימים 1 – 6  (6) →  סבב א': בית 🏠  |  סבב ב': בסיס 🛡️
      ימים 7 – 14 (8) →  סבב א': בסיס 🛡️ |  סבב ב': בית 🏠

    תקופת גיוס 26.4–29.4: כולם בבסיס (טרם תחילת הרוטינה).
    """
    if d < DEPLOYMENT_START or d > DEPLOYMENT_END:
        return None

    # 26–29 אפריל: כולם בבסיס (לפני תחילת הרוטינה)
    if d < ROUTINE_START:
        return "base"

    # חישוב מיקום ביום במחזור
    cycle_day = (d - ROUTINE_START).days % CYCLE_LENGTH

    # יום 0: יום משותף – כולם בבסיס
    if cycle_day == 0:
        return "base"

    # ימים 1–6
    if 1 <= cycle_day <= 6:
        return "home" if round_letter == "א" else "base"

    # ימים 7–14
    return "base" if round_letter == "א" else "home"


def get_personal_day_type(data, soldier_name, d):
    """
    מחזיר את סוג היום לחייל בתאריך d:
      'base'     → ביחידה (🛡️)
      'leave'    → יציאה מאושרת / החלפת ימים (🏠)
      'pending'  → ממתין לאישור
      None       → אין מידע (אין סבב מאושר)
    """
    round_letter = get_approved_round(data, soldier_name)
    if round_letter is None:
        return None

    base_type = day_type_by_round(d, round_letter)

    # בדיקת יציאה מאושרת
    for r in data["requests"]:
        if r["soldier_name"] == soldier_name and r["status"] == "Approved":
            rs = date.fromisoformat(r["start_date"])
            re = date.fromisoformat(r["end_date"])
            if rs <= d <= re:
                return "leave"

    # בדיקת החלפת ימים מאושרת (רק כמבקש)
    for sw in data["swaps"]:
        if sw["requester"] == soldier_name and sw["status"] == "Approved":
            rs = date.fromisoformat(sw["start_date"])
            re = date.fromisoformat(sw["end_date"])
            if rs <= d <= re:
                return "leave"

    return base_type


# ──────────────────────────────────────────────────────────
# דף כניסה
# ──────────────────────────────────────────────────────────
def login_page():
    st.markdown('<h1 style="text-align:center;">מערכת ניהול בקשות יציאה 🪖</h1>', unsafe_allow_html=True)
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        tab_login, tab_register = st.tabs(["🔑 התחברות", "📝 הרשמה (פעם ראשונה)"])

        with tab_login:
            login_name = st.text_input("שם מלא", key="login_name")
            login_pw   = st.text_input("סיסמה", type="password", key="login_pw")
            if st.button("כניסה", use_container_width=True, type="primary", key="btn_login"):
                data = load_data()
                user = next((s for s in data.get("soldiers", []) if s["name"] == login_name.strip()), None)
                if user and user.get("password") == login_pw:
                    st.query_params["user"] = user["name"]
                    st.session_state.logged_in    = True
                    st.session_state.role         = "commander" if user["pkal"] == "מפקד מחלקה" else "soldier"
                    st.session_state.soldier_name = user["name"]
                    st.session_state.soldier_pkal = user["pkal"]
                    st.rerun()
                else:
                    st.error("שם משתמש או סיסמה לא נכונים.")

        with tab_register:
            st.info("הרשמה חד-פעמית למערכת")
            reg_name = st.text_input("שם מלא", key="reg_name", placeholder="ישראל ישראלי")
            role_options = ["לוחם", "חובש", "קשר", "מטול", "קלע", "איבו", "אבטה", "נגב", "מאג", "מפקד מחלקה"]
            reg_role = st.selectbox('בחר פק"ל', role_options, key="reg_role")
            reg_pw   = st.text_input("בחר סיסמה", type="password", key="reg_pw")
            master_key = ""
            if reg_role == "מפקד מחלקה":
                master_key = st.text_input("קוד אישור מפקד מחלקה", type="password", key="master_key")
            if st.button("בצע הרשמה וכנס למערכת", use_container_width=True, key="btn_register"):
                data = load_data()
                if not reg_name.strip() or not reg_pw:
                    st.error("חובה להזין שם וסיסמה.")
                elif any(s["name"] == reg_name.strip() for s in data.get("soldiers", [])):
                    st.error("משתמש בשם זה כבר קיים.")
                elif reg_role == "מפקד מחלקה" and master_key != "1234":
                    st.error("קוד אישור מפקד שגוי.")
                else:
                    new_user = {"name": reg_name.strip(), "pkal": reg_role, "password": reg_pw}
                    data["soldiers"].append(new_user)
                    save_data(data)
                    st.query_params["user"] = new_user["name"]
                    st.session_state.logged_in    = True
                    st.session_state.role         = "commander" if reg_role == "מפקד מחלקה" else "soldier"
                    st.session_state.soldier_name = new_user["name"]
                    st.session_state.soldier_pkal = reg_role
                    st.rerun()

        st.markdown("---")
        with st.expander("📱 התקנת האפליקציה בטלפון"):
            st.markdown("""
**iPhone (Safari):**
1. פתח את האתר ב-Safari  
2. לחץ על כפתור השיתוף ↑  
3. בחר "הוסף למסך הבית"  

**Android (Chrome):**
1. פתח את האתר ב-Chrome  
2. לחץ על ⋮ בפינה העליונה  
3. בחר "הוסף למסך הבית"
            """)


# ──────────────────────────────────────────────────────────
# דאשבורד חייל
# ──────────────────────────────────────────────────────────
def soldier_dashboard():
    data         = load_data()
    soldier_name = st.session_state.soldier_name
    soldier_pkal = st.session_state.get("soldier_pkal", "")
    days_used    = days_used_by_soldier(data, soldier_name)
    label, val   = countdown_values()

    st.markdown(f'<h2 style="margin-bottom:2px;">ברוך הבא, {soldier_name} 👋</h2>', unsafe_allow_html=True)
    st.markdown(f'<p style="color:#555;font-size:16px;margin-top:0;">פק"ל: <strong>{soldier_pkal}</strong></p>', unsafe_allow_html=True)

    approved_round = get_approved_round(data, soldier_name)
    pending_round  = get_pending_round(data, soldier_name)

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("ימי בית מבקשות יציאה שאושרו", f"{days_used} ימים")
    with col2:
        st.metric(label, f"{val} ימים")
    with col3:
        my_requests = [r for r in data["requests"] if r["soldier_name"] == soldier_name]
        st.metric("סך בקשות שהוגשו", len(my_requests))
    with col4:
        if approved_round:
            st.metric("סבב מאושר", f"סבב {approved_round}'")
        elif pending_round:
            st.metric("סבב", f"סבב {pending_round}' – ממתין ✅")
        else:
            st.metric("סבב", "לא נבחר")

    st.markdown("---")

    tab_req, tab_hist, tab_round, tab_swap, tab_cal = st.tabs([
        "📋 בקשת יציאה",
        "📊 הבקשות שלי",
        "🔄 בחירת סבב",
        "🔁 החלפת ימים",
        "📅 לוח שנה אישי",
    ])

    # ── Tab: בקשת יציאה ──
    with tab_req:
        st.subheader("הגשת בקשת יציאה חדשה")
        with st.form("leave_form"):
            start_date = st.date_input("תאריך התחלה", min_value=date.today())
            end_date   = st.date_input("תאריך סיום",  min_value=date.today())
            reason     = st.text_area("סיבת היציאה", placeholder="לדוגמה: אירוע משפחתי, טיפול רפואי, מנוחה...")
            submitted  = st.form_submit_button("הגש בקשה", type="primary")
            if submitted:
                if end_date < start_date:
                    st.error("תאריך הסיום אינו יכול להיות לפני תאריך ההתחלה.")
                elif not reason.strip():
                    st.error("אנא ציין סיבה ליציאה.")
                else:
                    my_existing = [
                        r for r in data["requests"]
                        if r["soldier_name"] == soldier_name and r["status"] != "Denied"
                    ]
                    overlap = any(
                        not (end_date < date.fromisoformat(r["start_date"]) or
                             start_date > date.fromisoformat(r["end_date"]))
                        for r in my_existing
                    )
                    if overlap:
                        st.error("קיימת בקשה חופפת בתאריכים אלו. אנא בחר תאריכים אחרים.")
                    else:
                        overloaded = check_overlap_warning(data, soldier_name, start_date, end_date)
                        if overloaded:
                            formatted = [d.strftime("%d/%m") for d in overloaded[:3]]
                            extra = f" (+{len(overloaded)-3} נוספים)" if len(overloaded) > 3 else ""
                            st.warning(f"⚠️ אזהרה: בתאריכים {', '.join(formatted)}{extra} כבר {MAX_ON_LEAVE} חיילים ביציאה. הבקשה תוגש אך עשויה להידחות.")
                        data["requests"].append({
                            "id": get_next_id(data),
                            "soldier_name": soldier_name,
                            "start_date": str(start_date),
                            "end_date": str(end_date),
                            "reason": reason.strip(),
                            "status": "Pending",
                            "submitted_at": str(date.today()),
                        })
                        save_data(data)
                        st.success("✅ בקשת היציאה הוגשה בהצלחה!")
                        st.rerun()

    # ── Tab: הבקשות שלי ──
    with tab_hist:
        st.subheader("בקשות היציאה שלי")
        my_requests = [r for r in data["requests"] if r["soldier_name"] == soldier_name]
        if not my_requests:
            st.info("טרם הגשת בקשות יציאה.")
        else:
            status_icons  = {"Approved": "🟢", "Denied": "🔴", "Pending": "🟡"}
            status_labels = {"Approved": "אושרה ✅", "Denied": "נדחתה ❌", "Pending": "ממתינה 🟡"}
            for r in sorted(my_requests, key=lambda x: x["submitted_at"], reverse=True):
                icon   = status_icons.get(r["status"], "⚪")
                label2 = status_labels.get(r["status"], r["status"])
                with st.expander(f"{icon} {r['start_date']} ← {r['end_date']} | {label2}"):
                    days = (date.fromisoformat(r["end_date"]) - date.fromisoformat(r["start_date"])).days + 1
                    st.write(f"**משך:** {days} יום/ים")
                    st.write(f"**סיבה:** {r['reason']}")
                    st.write(f"**הוגש:** {r['submitted_at']}")
                    if r.get("commander_note"):
                        st.info(f"💬 הערת המפקד: {r['commander_note']}")

    # ── Tab: בחירת סבב ──
    with tab_round:
        st.subheader("בחירת סבב יציאות")
        st.info("בחר את הסבב שלך. הבחירה תישלח למפקד לאישור ותופיע בלוח השנה האישי לאחר האישור.")

        if approved_round:
            st.success(f"✅ הסבב המאושר שלך: **סבב {approved_round}'**")
            st.caption("ניתן לשנות בקשה – הבחירה החדשה תשלח לאישור המפקד מחדש.")

        if pending_round:
            st.warning(f"⏳ סבב {pending_round}' ממתין לאישור מפקד")

        with st.form("round_form"):
            chosen = st.radio(
                "בחר סבב",
                options=["א", "ב"],
                format_func=lambda x: f"סבב {x}'",
                horizontal=True,
            )
            submitted_round = st.form_submit_button("שלח לאישור מפקד", type="primary")
            if submitted_round:
                # הסר בקשות ממתינות ישנות
                data["rounds"] = [
                    r for r in data["rounds"]
                    if not (r["soldier_name"] == soldier_name and r["status"] == "Pending")
                ]
                data["rounds"].append({
                    "soldier_name": soldier_name,
                    "round": chosen,
                    "status": "Pending",
                    "submitted_at": str(date.today()),
                })
                save_data(data)
                st.success(f"✅ בקשת סבב {chosen}' נשלחה למפקד לאישור!")
                st.rerun()

    # ── Tab: החלפת ימים ──
    with tab_swap:
        st.subheader("בקשת החלפת ימים")
        st.info("הגש בקשת החלפת ימים עם חייל אחר. לאחר אישור המפקד, הימים יתעדכנו בלוח השנה של שניכם.")

        soldiers_list = [
            s["name"] for s in data.get("soldiers", [])
            if s["name"] != soldier_name
        ]

        if not soldiers_list:
            st.warning("אין חיילים נוספים רשומים במערכת.")
        else:
            with st.form("swap_form"):
                partner    = st.selectbox("שם החייל להחלפה", soldiers_list)
                swap_start = st.date_input("תאריך התחלת ההחלפה", min_value=DEPLOYMENT_START, max_value=DEPLOYMENT_END)
                swap_end   = st.date_input("תאריך סיום ההחלפה",  min_value=DEPLOYMENT_START, max_value=DEPLOYMENT_END)
                submitted_swap = st.form_submit_button("שלח בקשת החלפה", type="primary")
                if submitted_swap:
                    if swap_end < swap_start:
                        st.error("תאריך הסיום חייב להיות אחרי תאריך ההתחלה.")
                    else:
                        data["swaps"].append({
                            "id": get_next_id(data),
                            "requester": soldier_name,
                            "partner": partner,
                            "start_date": str(swap_start),
                            "end_date": str(swap_end),
                            "status": "Pending",
                            "submitted_at": str(date.today()),
                        })
                        save_data(data)
                        st.success(f"✅ בקשת ההחלפה עם {partner} נשלחה למפקד!")
                        st.rerun()

        # הצגת בקשות החלפה קיימות
        my_swaps = [sw for sw in data["swaps"] if sw["requester"] == soldier_name]
        if my_swaps:
            st.markdown("#### בקשות החלפה שהגשתי")
            status_map = {"Pending": "ממתינה 🟡", "Approved": "אושרה ✅", "Denied": "נדחתה ❌"}
            for sw in sorted(my_swaps, key=lambda x: x["submitted_at"], reverse=True):
                days = (date.fromisoformat(sw["end_date"]) - date.fromisoformat(sw["start_date"])).days + 1
                st.markdown(f"- עם **{sw['partner']}** | {sw['start_date']} ← {sw['end_date']} ({days} ימים) | {status_map.get(sw['status'], sw['status'])}")

    # ── Tab: לוח שנה אישי ──
    with tab_cal:
        st.subheader("לוח שנה אישי")

        approved_round_letter = get_approved_round(data, soldier_name)
        if not approved_round_letter:
            if get_pending_round(data, soldier_name):
                st.warning("⏳ הסבב שלך ממתין לאישור המפקד. הלוח יוצג לאחר האישור.")
            else:
                st.info("📌 לא נבחר סבב עדיין. עבור ללשונית 'בחירת סבב' כדי לבחור.")
        else:
            st.markdown(f"**סבב מאושר: סבב {approved_round_letter}'** &nbsp; | &nbsp; 🛡️ביחידה &nbsp; 🏠בבית")
            st.markdown("---")

            calendar.setfirstweekday(calendar.SUNDAY)
            month_names = {4: "אפריל", 5: "מאי", 6: "יוני"}

            def _classify(d):
                """קובע את קטגוריית היום לצביעה – לפי סדר קדימות."""
                # עדיפות 1: החלפת ימים מאושרת (יוזם או שותף)
                for sw in data["swaps"]:
                    if sw["status"] == "Approved" and (sw["requester"] == soldier_name or sw["partner"] == soldier_name):
                        if date.fromisoformat(sw["start_date"]) <= d <= date.fromisoformat(sw["end_date"]):
                            return "swap"
                # עדיפות 2: בקשת יציאה מאושרת
                for r in data["requests"]:
                    if r["soldier_name"] == soldier_name and r["status"] == "Approved":
                        if date.fromisoformat(r["start_date"]) <= d <= date.fromisoformat(r["end_date"]):
                            return "leave"
                # עדיפות 3+4: לפי הסבב המאושר
                return day_type_by_round(d, approved_round_letter) or "base"

            for m_num in [4, 5, 6]:
                st.markdown(f"#### {month_names[m_num]} 2026")
                header_cols = st.columns(7)
                for i, lbl in enumerate(["א'","ב'","ג'","ד'","ה'","ו'","שבת"]):
                    header_cols[i].markdown(f"<div style='text-align:center;font-weight:bold;font-size:13px;'>{lbl}</div>", unsafe_allow_html=True)

                for week in calendar.monthcalendar(2026, m_num):
                    cols = st.columns(7)
                    for i, day in enumerate(week):
                        if day == 0:
                            cols[i].markdown("<div style='min-height:62px;'></div>", unsafe_allow_html=True)
                            continue
                        curr_date = date(2026, m_num, day)
                        if not (DEPLOYMENT_START <= curr_date <= DEPLOYMENT_END):
                            cols[i].markdown(f"<div style='background:#f8f9fa;padding:6px 3px;border-radius:6px;text-align:center;opacity:0.3;margin-bottom:3px;border:1px solid #dee2e6;'><div style='font-size:13px;'>{day}</div></div>", unsafe_allow_html=True)
                            continue
                        cat = _classify(curr_date)
                        if cat == "swap":
                            bg, bd, label = "#d0ebff", "#a5d8ff", "החלפה 🏠"
                        elif cat == "leave":
                            bg, bd, label = "#fff3cd", "#ffe69c", "חופשה 🏠"
                        elif cat == "home":
                            bg, bd, label = "#d4edda", "#c3e6cb", "בבית 🏠"
                        else:
                            bg, bd, label = "#e2e3e5", "#ccc", "בבסיס 🛡️"
                        cols[i].markdown(f"<div style='background:{bg};padding:6px 3px;border-radius:6px;text-align:center;border:1px solid {bd};margin-bottom:3px;'><div style='font-weight:bold;font-size:14px;'>{day}</div><div style='font-size:11px;margin-top:2px;'>{label}</div></div>", unsafe_allow_html=True)

            st.markdown("---")
            st.markdown("<div style='font-size:13px;'>🟦 החלפת ימים מאושרת &nbsp;&nbsp; 🟨 יציאה מאושרת &nbsp;&nbsp; 🟩 בבית לפי סבב &nbsp;&nbsp; ◻️ בבסיס / יום משותף</div>", unsafe_allow_html=True)


# ──────────────────────────────────────────────────────────
# דאשבורד מפקד
# ──────────────────────────────────────────────────────────
def commander_dashboard():
    data = load_data()
    st.title("🎖️ לוח בקרה – מפקד מחלקה")

    tab1, tab2, tab3, tab4 = st.tabs([
        "📋 כל הבקשות",
        "📅 לוח כוח אדם",
        "📊 סקירת חיילים",
        '👥 ניהול סד"כ',
    ])

    # ── Tab 1: כל הבקשות ──
    with tab1:
        # ── בקשות יציאה רגילות ──
        st.subheader("בקשות יציאה")
        if not data["requests"]:
            st.info("לא הוגשו בקשות יציאה עדיין.")
        else:
            status_map = {"הכל": "All", "ממתינה": "Pending", "אושרה": "Approved", "נדחתה": "Denied"}
            filter_lbl = st.selectbox("סינון לפי סטטוס", list(status_map.keys()), key="filter_req")
            filtered   = [
                r for r in data["requests"]
                if status_map[filter_lbl] == "All" or r["status"] == status_map[filter_lbl]
            ]
            status_heb = {"Approved": "אושרה ✅", "Denied": "נדחתה ❌", "Pending": "ממתינה 🟡"}
            for r in sorted(filtered, key=lambda x: x["submitted_at"], reverse=True):
                with st.expander(f"{r['soldier_name']} | {r['start_date']} ← {r['end_date']} | {status_heb.get(r['status'], r['status'])}"):
                    st.write(f"**סיבה:** {r['reason']}")
                    st.write(f"**הוגש:** {r['submitted_at']}")
                    note = st.text_input("הערה למגיש", value=r.get("commander_note", ""), key=f"note_{r['id']}")
                    c1, c2, c3 = st.columns(3)
                    if c1.button("✅ אשר", key=f"app_{r['id']}"):
                        r["status"] = "Approved"; r["commander_note"] = note; save_data(data); st.rerun()
                    if c2.button("❌ דחה", key=f"den_{r['id']}"):
                        r["status"] = "Denied"; r["commander_note"] = note; save_data(data); st.rerun()
                    if c3.button("⏳ ממתין", key=f"pnd_{r['id']}"):
                        r["status"] = "Pending"; r["commander_note"] = note; save_data(data); st.rerun()

        # ── אישור בחירות סבב ──
        st.markdown("---")
        st.subheader("🔄 בחירות סבב – ממתינות לאישור")
        pending_rounds = [r for r in data["rounds"] if r["status"] == "Pending"]
        if not pending_rounds:
            st.info("אין בחירות סבב ממתינות.")
        else:
            for idx, r in enumerate(pending_rounds):
                c1, c2, c3 = st.columns([3, 1, 1])
                c1.markdown(f"**{r['soldier_name']}** – סבב **{r['round']}'** (הוגש: {r['submitted_at']})")
                if c2.button("✅ אשר", key=f"rnd_app_{idx}"):
                    # בטל את כל הסבבים הקודמים המאושרים לאותו חייל
                    for ex in data["rounds"]:
                        if ex["soldier_name"] == r["soldier_name"] and ex["status"] == "Approved":
                            ex["status"] = "Replaced"
                    r["status"] = "Approved"
                    save_data(data)
                    st.rerun()
                if c3.button("❌ דחה", key=f"rnd_den_{idx}"):
                    r["status"] = "Denied"
                    save_data(data)
                    st.rerun()

        # ── אישור החלפות ימים ──
        st.markdown("---")
        st.subheader("🔁 החלפות ימים – ממתינות לאישור")
        pending_swaps = [sw for sw in data["swaps"] if sw["status"] == "Pending"]
        if not pending_swaps:
            st.info("אין בקשות החלפה ממתינות.")
        else:
            for sw in pending_swaps:
                days = (date.fromisoformat(sw["end_date"]) - date.fromisoformat(sw["start_date"])).days + 1
                c1, c2, c3 = st.columns([3, 1, 1])
                c1.markdown(f"**{sw['requester']}** ↔ **{sw['partner']}** | {sw['start_date']} ← {sw['end_date']} ({days} ימים)")
                if c2.button("✅ אשר", key=f"sw_app_{sw['id']}"):
                    sw["status"] = "Approved"; save_data(data); st.rerun()
                if c3.button("❌ דחה", key=f"sw_den_{sw['id']}"):
                    sw["status"] = "Denied"; save_data(data); st.rerun()

    # ── Tab 2: לוח כוח אדם ──
    with tab2:
        st.subheader('לוח סד"כ – תעסוקה מבצעית')
        day_counts = count_on_leave_per_day(data, DEPLOYMENT_START, DEPLOYMENT_END)
        month_names = {4: "אפריל", 5: "מאי", 6: "יוני"}
        calendar.setfirstweekday(calendar.SUNDAY)

        for m_num in [4, 5, 6]:
            st.markdown(f"#### {month_names[m_num]} 2026")
            header_cols = st.columns(7)
            for i, lbl in enumerate(["א'","ב'","ג'","ד'","ה'","ו'","שבת"]):
                header_cols[i].markdown(f"<div style='text-align:center;font-weight:bold;font-size:13px;'>{lbl}</div>", unsafe_allow_html=True)

            for week in calendar.monthcalendar(2026, m_num):
                cols = st.columns(7)
                for i, day in enumerate(week):
                    if day == 0:
                        cols[i].markdown("<div style='min-height:60px;'></div>", unsafe_allow_html=True)
                        continue
                    curr_date = date(2026, m_num, day)
                    if DEPLOYMENT_START <= curr_date <= DEPLOYMENT_END:
                        on_leave = day_counts.get(curr_date, 0)
                        on_duty  = TOTAL_SOLDIERS - on_leave
                        bg    = "#ffcccc" if on_duty < MIN_ON_DUTY else "#e6ffe6"
                        color = "#cc0000" if on_duty < MIN_ON_DUTY else "#1a6b1a"
                        cols[i].markdown(f"<div style='background:{bg};padding:8px 4px;border-radius:6px;text-align:center;border:1px solid #ccc;margin-bottom:4px;'><div style='font-weight:bold;font-size:15px;'>{day}</div><div style='font-size:12px;color:{color};font-weight:bold;'>⚔ {on_duty}</div></div>", unsafe_allow_html=True)
                    else:
                        cols[i].markdown(f"<div style='background:#f0f2f6;padding:8px 4px;border-radius:6px;text-align:center;opacity:0.35;margin-bottom:4px;'><div style='font-size:15px;'>{day}</div></div>", unsafe_allow_html=True)

        st.markdown("---")
        st.caption(f'🟥 סד"כ פחות מ-{MIN_ON_DUTY} = התראה  |  🟩 תקין')

    # ── Tab 3: סקירת חיילים ──
    with tab3:
        st.subheader("סקירת ימי יציאה לפי חייל")
        all_reqs = data["requests"]
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("סך הבקשות",  len(all_reqs))
        m2.metric("ממתינות",   sum(1 for r in all_reqs if r["status"] == "Pending"))
        m3.metric("אושרו",     sum(1 for r in all_reqs if r["status"] == "Approved"))
        m4.metric("נדחו",      sum(1 for r in all_reqs if r["status"] == "Denied"))
        st.markdown("---")

        soldiers = data.get("soldiers", [])
        if not soldiers:
            st.info("אין עדיין חיילים רשומים.")
        else:
            rows = []
            for s in soldiers:
                approved_round = get_approved_round(data, s["name"])
                rows.append({
                    "שם": s["name"],
                    'פק"ל': s["pkal"],
                    "סבב מאושר": f"סבב {approved_round}'" if approved_round else "—",
                    "ימי יציאה שאושרו": days_used_by_soldier(data, s["name"]),
                    "ימי יציאה שנדחו":  days_denied_by_soldier(data, s["name"]),
                })
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    # ── Tab 4: ניהול סד"כ ──
    with tab4:
        st.subheader('ניהול סד"כ – מאגר חיילים')
        soldiers = data.get("soldiers", [])
        if not soldiers:
            st.info("הרשימה תתמלא כשהחיילים יכנסו למערכת.")
        else:
            st.caption(f'סה"כ {len(soldiers)} חיילים רשומים')
            for idx, s in enumerate(soldiers):
                col_name, col_pkal, col_btn = st.columns([3, 2, 1])
                col_name.write(s["name"])
                col_pkal.write(s["pkal"])
                if col_btn.button("🗑️ מחק", key=f"del_{idx}_{s['name']}"):
                    data["soldiers"] = [x for x in data["soldiers"] if x["name"] != s["name"]]
                    save_data(data)
                    st.rerun()


# ──────────────────────────────────────────────────────────
# פונקציה ראשית
# ──────────────────────────────────────────────────────────
def main():
    st.markdown(RTL_CSS, unsafe_allow_html=True)
    data = load_data()

    if "logged_in" not in st.session_state:
        saved_user = st.query_params.get("user")
        if saved_user:
            user = next((s for s in data.get("soldiers", []) if s["name"] == saved_user), None)
            if user:
                st.session_state.logged_in    = True
                st.session_state.role         = "commander" if user["pkal"] == "מפקד מחלקה" else "soldier"
                st.session_state.soldier_name = user["name"]
                st.session_state.soldier_pkal = user["pkal"]
            else:
                st.session_state.logged_in = False
        else:
            st.session_state.logged_in = False

    if not st.session_state.logged_in:
        login_page()
        return

    with st.sidebar:
        st.markdown(f"**מחובר כ:**  \n{st.session_state.soldier_name}")
        pkal = st.session_state.get("soldier_pkal", "")
        if pkal:
            st.caption(f'פק"ל: {pkal}')
        if st.session_state.role == "commander":
            st.badge('מ"מ', color="blue")
        else:
            st.badge("חייל", color="green")
        st.markdown("---")
        label, val = countdown_values()
        st.metric(label, f"{val} ימים")
        st.caption(f"סיום תעסוקה: {DEPLOYMENT_END.strftime('%d/%m/%Y')}")
        st.markdown("---")
        if st.button("🚪 התנתקות", use_container_width=True):
            st.query_params.clear()
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()

    if st.session_state.role == "commander":
        commander_dashboard()
    else:
        soldier_dashboard()


if __name__ == "__main__":
    main()
