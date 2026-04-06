import streamlit as st
import json
import os
import calendar
from datetime import date, datetime, timedelta
import pandas as pd
import extra_streamlit_components as stx

# ─── קבועים ───────────────────────────────────────────────
DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "data.json")
TOTAL_SOLDIERS = 30
MAX_ON_LEAVE = 18
MIN_ON_DUTY = 12
DEPLOYMENT_START = date(2026, 4, 26)
DEPLOYMENT_END   = date(2026, 6, 25)

DAYS_HEB = {
    "Sun": "ראשון", "Mon": "שני", "Tue": "שלישי",
    "Wed": "רביעי", "Thu": "חמישי", "Fri": "שישי", "Sat": "שבת",
}

# ─── Cookie Manager (חייב להיות ברמה הגלובלית) ────────────
cookie_manager = stx.CookieManager()

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

    /* ── Sidebar ── */
    [data-testid="stSidebar"] {
        direction: rtl;
        text-align: right;
        overflow: hidden !important;
    }
    [data-testid="stSidebarUserContent"] {
        white-space: nowrap !important;
        overflow: hidden !important;
    }
    [data-testid="stSidebar"][aria-expanded="false"] [data-testid="stSidebarUserContent"] {
        display: none !important;
        opacity: 0 !important;
    }

    /* ── כפתור פתיחת סיידבר (מקובע ימין-עליון) ── */
    [data-testid="stSidebarCollapsedControl"] {
        position: absolute !important;
        top: 15px !important;
        right: 15px !important;
        left: auto !important;
        z-index: 9999 !important;
        opacity: 1 !important;
        background: #1f3a5f !important;
        border-radius: 8px !important;
        padding: 4px !important;
    }
    [data-testid="stSidebarCollapsedControl"] svg { fill: white !important; }

    /* ── הסתרת תפריטים מיותרים ── */
    #MainMenu { display: none !important; }
    .stAppDeployButton { display: none !important; }
    [data-testid="stHeader"] { background: transparent !important; }
    [data-testid="stHeader"] > div:first-child { display: none !important; }

    /* ── טבלאות ── */
    [data-testid="stDataFrame"] th,
    [data-testid="stDataFrame"] td { text-align: right !important; direction: rtl; }

    /* ── אקספנדרים ── */
    [data-testid="stExpander"] * { direction: rtl; text-align: right; }
    [data-testid="stExpanderToggleIcon"] { float: left; }
</style>
"""


# ─── פונקציות נתונים ──────────────────────────────────────
def load_data():
    if not os.path.exists(DATA_FILE):
        return {"requests": [], "soldiers": []}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    if "soldiers" not in data:
        data["soldiers"] = []
    return data


def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


def get_next_id(data):
    if not data["requests"]:
        return 1
    return max(r["id"] for r in data["requests"]) + 1


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
        count = sum(
            1 for r in approved_others
            if date.fromisoformat(r["start_date"]) <= current <= date.fromisoformat(r["end_date"])
        )
        if count >= MAX_ON_LEAVE:
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


# ─── דף כניסה ─────────────────────────────────────────────
def login_page():
    st.markdown('<h1 style="text-align:center;">מערכת ניהול בקשות יציאה 🪖</h1>', unsafe_allow_html=True)
    st.markdown("---")

    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        tab_login, tab_register = st.tabs(["🔑 התחברות", "📝 הרשמה (פעם ראשונה)"])

        # ── התחברות ──
        with tab_login:
            login_name = st.text_input("שם מלא", key="login_name")
            login_pw   = st.text_input("סיסמה", type="password", key="login_pw")

            if st.button("כניסה", use_container_width=True, type="primary", key="btn_login"):
                data = load_data()
                user = next(
                    (s for s in data.get("soldiers", []) if s["name"] == login_name.strip()),
                    None,
                )
                if user and user.get("password") == login_pw:
                    cookie_manager.set(
                        "saved_username", user["name"],
                        expires_at=datetime.now() + timedelta(days=30),
                    )
                    st.session_state.logged_in    = True
                    st.session_state.role         = "commander" if user["pkal"] == "מפקד מחלקה" else "soldier"
                    st.session_state.soldier_name = user["name"]
                    st.session_state.soldier_pkal = user["pkal"]
                    st.rerun()
                else:
                    st.error("שם משתמש או סיסמה לא נכונים.")

        # ── הרשמה ──
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
                    cookie_manager.set(
                        "saved_username", new_user["name"],
                        expires_at=datetime.now() + timedelta(days=30),
                    )
                    st.session_state.logged_in    = True
                    st.session_state.role         = "commander" if reg_role == "מפקד מחלקה" else "soldier"
                    st.session_state.soldier_name = new_user["name"]
                    st.session_state.soldier_pkal = reg_role
                    st.rerun()

        # ── התקנה למסך הבית ──
        st.markdown("---")
        with st.expander("📱 התקנת האפליקציה בטלפון"):
            st.markdown("""
**iPhone (Safari):**
1. פתח את האתר ב-Safari
2. לחץ על כפתור השיתוף ↑ בתחתית המסך
3. בחר "הוסף למסך הבית"
4. אשר בלחיצה על "הוסף"

**Android (Chrome):**
1. פתח את האתר ב-Chrome
2. לחץ על 3 הנקודות ⋮ בפינה העליונה
3. בחר "הוסף למסך הבית" או "התקן אפליקציה"
4. אשר בלחיצה על "הוסף"
            """)


# ─── דאשבורד חייל ─────────────────────────────────────────
def soldier_dashboard():
    data = load_data()
    soldier_name = st.session_state.soldier_name
    days_used    = days_used_by_soldier(data, soldier_name)
    label, val   = countdown_values()

    st.title(f"ברוך הבא, {soldier_name} 👋")

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("ימי חופשה שנוצלו", f"{days_used} ימים", help=f"מתוך מכסה של {MAX_ON_LEAVE} ימים")
    with col2:
        st.metric(label, f"{val} ימים")
    with col3:
        my_requests = [r for r in data["requests"] if r["soldier_name"] == soldier_name]
        st.metric("סך בקשות שהוגשו", len(my_requests))

    st.markdown("---")
    tab1, tab2 = st.tabs(["📋 הגשת בקשת חופשה", "📊 הבקשות שלי"])

    with tab1:
        st.subheader("הגשת בקשת חופשה חדשה")
        with st.form("leave_form"):
            start_date = st.date_input("תאריך התחלה", min_value=date.today())
            end_date   = st.date_input("תאריך סיום",  min_value=date.today())
            reason     = st.text_area("סיבת החופשה", placeholder="לדוגמה: אירוע משפחתי, טיפול רפואי, מנוחה...")
            submitted  = st.form_submit_button("הגש בקשה", type="primary")

            if submitted:
                if end_date < start_date:
                    st.error("תאריך הסיום אינו יכול להיות לפני תאריך ההתחלה.")
                elif not reason.strip():
                    st.error("אנא ציין סיבה לחופשה.")
                else:
                    # בדיקת חפיפה עם בקשות קיימות של אותו חייל
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
                            st.warning(
                                f"⚠️ אזהרה: בתאריכים {', '.join(formatted)}{extra} "
                                f"כבר {MAX_ON_LEAVE} חיילים בחופשה. "
                                "הבקשה תוגש אך עשויה להידחות."
                            )
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
                        st.success("✅ בקשת החופשה הוגשה בהצלחה!")
                        st.rerun()

    with tab2:
        st.subheader("בקשות החופשה שלי")
        my_requests = [r for r in data["requests"] if r["soldier_name"] == soldier_name]
        if not my_requests:
            st.info("טרם הגשת בקשות חופשה.")
        else:
            status_labels = {"Approved": "אושרה ✅", "Denied": "נדחתה ❌", "Pending": "ממתינה 🟡"}
            status_icons  = {"Approved": "🟢", "Denied": "🔴", "Pending": "🟡"}
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


# ─── דאשבורד מפקד ─────────────────────────────────────────
def commander_dashboard():
    data = load_data()
    st.title("🎖️ לוח בקרה – מפקד מחלקה")

    tab1, tab2, tab3, tab4 = st.tabs([
        "📋 כל הבקשות",
        "📅 לוח כוח אדם",
        "📊 סקירת חיילים",
        "👥 ניהול סד\"כ",
    ])

    # ── Tab 1: כל הבקשות ──
    with tab1:
        st.subheader("כל בקשות החופשה")
        if not data["requests"]:
            st.info("לא הוגשו בקשות חופשה עדיין.")
        else:
            status_map = {"הכל": "All", "ממתינה": "Pending", "אושרה": "Approved", "נדחתה": "Denied"}
            filter_lbl = st.selectbox("סינון לפי סטטוס", list(status_map.keys()), key="filter_status")
            filtered   = [
                r for r in data["requests"]
                if status_map[filter_lbl] == "All" or r["status"] == status_map[filter_lbl]
            ]
            status_heb = {"Approved": "אושרה ✅", "Denied": "נדחתה ❌", "Pending": "ממתינה 🟡"}
            for r in sorted(filtered, key=lambda x: x["submitted_at"], reverse=True):
                with st.expander(
                    f"{r['soldier_name']} | {r['start_date']} ← {r['end_date']} | {status_heb.get(r['status'], r['status'])}"
                ):
                    st.write(f"**סיבה:** {r['reason']}")
                    st.write(f"**הוגש:** {r['submitted_at']}")
                    note = st.text_input("הערה למגיש", value=r.get("commander_note", ""), key=f"note_{r['id']}")
                    c1, c2, c3 = st.columns(3)
                    if c1.button("✅ אשר", key=f"app_{r['id']}"):
                        r["status"] = "Approved"
                        r["commander_note"] = note
                        save_data(data)
                        st.rerun()
                    if c2.button("❌ דחה", key=f"den_{r['id']}"):
                        r["status"] = "Denied"
                        r["commander_note"] = note
                        save_data(data)
                        st.rerun()
                    if c3.button("⏳ ממתין", key=f"pnd_{r['id']}"):
                        r["status"] = "Pending"
                        r["commander_note"] = note
                        save_data(data)
                        st.rerun()

    # ── Tab 2: לוח כוח אדם ──
    with tab2:
        st.subheader('לוח סד"כ – תעסוקה מבצעית')
        day_counts = count_on_leave_per_day(data, DEPLOYMENT_START, DEPLOYMENT_END)

        month_names = {4: "אפריל", 5: "מאי", 6: "יוני"}
        calendar.setfirstweekday(calendar.SUNDAY)

        for m_num in [4, 5, 6]:
            st.markdown(f"#### {month_names[m_num]} 2026")
            # כותרות ימים (RTL: ראשון בימין → שבת בשמאל)
            header_cols = st.columns(7)
            day_labels  = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "שבת"]
            for i, lbl in enumerate(day_labels):
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
                        cols[i].markdown(
                            f"<div style='background:{bg};padding:8px 4px;border-radius:6px;"
                            f"text-align:center;border:1px solid #ccc;margin-bottom:4px;'>"
                            f"<div style='font-weight:bold;font-size:15px;'>{day}</div>"
                            f"<div style='font-size:12px;color:{color};font-weight:bold;'>⚔ {on_duty}</div>"
                            f"</div>",
                            unsafe_allow_html=True,
                        )
                    else:
                        cols[i].markdown(
                            f"<div style='background:#f0f2f6;padding:8px 4px;border-radius:6px;"
                            f"text-align:center;opacity:0.35;margin-bottom:4px;'>"
                            f"<div style='font-size:15px;'>{day}</div></div>",
                            unsafe_allow_html=True,
                        )

        st.markdown("---")
        st.caption(f"🟥 סד\"כ פחות מ-{MIN_ON_DUTY} = התראה | 🟩 תקין")

    # ── Tab 3: סקירת חיילים ──
    with tab3:
        st.subheader("סקירת ימי חופשה לפי חייל")
        all_reqs = data["requests"]
        total    = len(all_reqs)
        pending  = sum(1 for r in all_reqs if r["status"] == "Pending")
        approved = sum(1 for r in all_reqs if r["status"] == "Approved")
        denied   = sum(1 for r in all_reqs if r["status"] == "Denied")
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("סך הבקשות", total)
        m2.metric("ממתינות", pending)
        m3.metric("אושרו", approved)
        m4.metric("נדחו", denied)
        st.markdown("---")

        soldiers = data.get("soldiers", [])
        if not soldiers:
            st.info("אין עדיין חיילים רשומים.")
        else:
            rows = [
                {
                    "שם": s["name"],
                    'פק"ל': s["pkal"],
                    "ימי חופשה שאושרו": days_used_by_soldier(data, s["name"]),
                    "ימי חופשה שנדחו":  days_denied_by_soldier(data, s["name"]),
                }
                for s in soldiers
            ]
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    # ── Tab 4: ניהול סד"כ ──
    with tab4:
        st.subheader('ניהול סד"כ – מאגר חיילים')
        soldiers = data.get("soldiers", [])
        if not soldiers:
            st.info("הרשימה תתמלא כשהחיילים יכנסו למערכת.")
        else:
            st.caption(f"סה\"כ {len(soldiers)} חיילים רשומים")
            for idx, s in enumerate(soldiers):
                col_name, col_pkal, col_btn = st.columns([3, 2, 1])
                col_name.write(s["name"])
                col_pkal.write(s["pkal"])
                if col_btn.button("🗑️ מחק", key=f"del_{idx}_{s['name']}"):
                    data["soldiers"] = [x for x in data["soldiers"] if x["name"] != s["name"]]
                    save_data(data)
                    st.rerun()


# ─── פונקציה ראשית ────────────────────────────────────────
def main():
    st.markdown(RTL_CSS, unsafe_allow_html=True)
    data = load_data()

    # שחזור כניסה אוטומטית מהעוגייה (רק אם טרם קבענו מצב)
    if "logged_in" not in st.session_state:
        saved_user = cookie_manager.get(cookie="saved_username")
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

    # ── סיידבר ──
    with st.sidebar:
        st.markdown(f"**מחובר כ:**  \n{st.session_state.soldier_name}")
        if st.session_state.role == "commander":
            st.badge("מ\"מ", color="blue")
        else:
            st.badge("חייל", color="green")
        st.markdown("---")

        label, val = countdown_values()
        st.metric(label, f"{val} ימים")
        st.caption(f"סיום תעסוקה: {DEPLOYMENT_END.strftime('%d/%m/%Y')}")
        st.markdown("---")

        if st.button("🚪 התנתקות", use_container_width=True):
            cookie_manager.delete("saved_username")
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()

    # ── ניתוב לפי תפקיד ──
    if st.session_state.role == "commander":
        commander_dashboard()
    else:
        soldier_dashboard()


if __name__ == "__main__":
    main()
