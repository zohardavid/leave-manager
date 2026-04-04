import streamlit as st
import json
import os
from datetime import date, datetime, timedelta
import pandas as pd

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "data.json")
TOTAL_SOLDIERS = 30
MAX_ON_LEAVE = 18
MIN_ON_DUTY = 12

DEPLOYMENT_END = date(2026, 12, 31)

SOLDIERS = [
    {"name": "SGT James Carter", "pkal": "PKAL001"},
    {"name": "CPL Maria Santos", "pkal": "PKAL002"},
    {"name": "PFC David Kim", "pkal": "PKAL003"},
    {"name": "SPC Rachel Lee", "pkal": "PKAL004"},
    {"name": "SSG Omar Yusuf", "pkal": "PKAL005"},
    {"name": "PVT Ana Gomez", "pkal": "PKAL006"},
    {"name": "CPT Michael Brown", "pkal": "PKAL007"},
    {"name": "LT Sarah Nguyen", "pkal": "PKAL008"},
    {"name": "SGT Thomas White", "pkal": "PKAL009"},
    {"name": "CPL Jessica Patel", "pkal": "PKAL010"},
    {"name": "PFC Kevin Okafor", "pkal": "PKAL011"},
    {"name": "SPC Laura Martinez", "pkal": "PKAL012"},
    {"name": "SSG Ahmed Hassan", "pkal": "PKAL013"},
    {"name": "PVT Emily Clark", "pkal": "PKAL014"},
    {"name": "SGT Brian Scott", "pkal": "PKAL015"},
    {"name": "CPL Nicole Adams", "pkal": "PKAL016"},
    {"name": "PFC Daniel Torres", "pkal": "PKAL017"},
    {"name": "SPC Hannah Wilson", "pkal": "PKAL018"},
    {"name": "SSG Luis Rivera", "pkal": "PKAL019"},
    {"name": "PVT Megan Harris", "pkal": "PKAL020"},
    {"name": "SGT Tyler Johnson", "pkal": "PKAL021"},
    {"name": "CPL Priya Shah", "pkal": "PKAL022"},
    {"name": "PFC Marcus Reed", "pkal": "PKAL023"},
    {"name": "SPC Olivia Chen", "pkal": "PKAL024"},
    {"name": "SSG Patrick Murphy", "pkal": "PKAL025"},
    {"name": "PVT Fatima Al-Rashid", "pkal": "PKAL026"},
    {"name": "SGT Carlos Diaz", "pkal": "PKAL027"},
    {"name": "CPL Zoe Thompson", "pkal": "PKAL028"},
    {"name": "PFC Nathan Brooks", "pkal": "PKAL029"},
    {"name": "SPC Alicia Ford", "pkal": "PKAL030"},
]

COMMANDER = {"name": "MAJ Robert Steele", "pkal": "COMMANDER"}


def load_data():
    if not os.path.exists(DATA_FILE):
        return {"requests": []}
    with open(DATA_FILE, "r") as f:
        return json.load(f)


def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


def get_next_id(data):
    if not data["requests"]:
        return 1
    return max(r["id"] for r in data["requests"]) + 1


def count_on_leave_per_day(data, start_date=None, end_date=None):
    if start_date is None:
        start_date = date.today()
    if end_date is None:
        end_date = start_date + timedelta(days=60)
    day_counts = {}
    approved = [r for r in data["requests"] if r["status"] == "Approved"]
    current = start_date
    while current <= end_date:
        count = 0
        for r in approved:
            rs = date.fromisoformat(r["start_date"])
            re = date.fromisoformat(r["end_date"])
            if rs <= current <= re:
                count += 1
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


def check_overlap_warning(data, soldier_name, start_d, end_d):
    day_counts = {}
    approved = [r for r in data["requests"] if r["status"] == "Approved" and r["soldier_name"] != soldier_name]
    current = start_d
    while current <= end_d:
        count = 0
        for r in approved:
            rs = date.fromisoformat(r["start_date"])
            re = date.fromisoformat(r["end_date"])
            if rs <= current <= re:
                count += 1
        day_counts[current] = count
        current += timedelta(days=1)
    overloaded = [d for d, c in day_counts.items() if c >= MAX_ON_LEAVE]
    return overloaded


st.set_page_config(page_title="Unit Leave Manager", page_icon="🪖", layout="wide")


def login_page():
    st.title("🪖 Unit Leave Management System")
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.subheader("Login")
        name = st.text_input("Full Name", placeholder="e.g. SGT James Carter")
        pkal = st.text_input("PKAL Code", placeholder="e.g. PKAL001", type="password")
        if st.button("Login", use_container_width=True, type="primary"):
            if pkal.upper() == COMMANDER["pkal"]:
                st.session_state.logged_in = True
                st.session_state.role = "commander"
                st.session_state.soldier_name = COMMANDER["name"]
                st.rerun()
            else:
                match = None
                for s in SOLDIERS:
                    if s["pkal"].upper() == pkal.upper() and s["name"].lower() == name.lower():
                        match = s
                        break
                if match:
                    st.session_state.logged_in = True
                    st.session_state.role = "soldier"
                    st.session_state.soldier_name = match["name"]
                    st.session_state.soldier_pkal = match["pkal"]
                    st.rerun()
                else:
                    st.error("Invalid name or PKAL. Please try again.")
        st.markdown("---")
        st.caption("**Commander login:** Use PKAL code `COMMANDER` (any name)")
        st.caption("**Soldier login:** Use your full name and assigned PKAL code (PKAL001–PKAL030)")


def soldier_dashboard():
    data = load_data()
    soldier_name = st.session_state.soldier_name
    days_used = days_used_by_soldier(data, soldier_name)
    days_to_end = (DEPLOYMENT_END - date.today()).days

    st.title(f"Welcome, {soldier_name}")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Leave Days Used", f"{days_used} days")
    with col2:
        st.metric("Days Until End of Deployment", f"{days_to_end} days", delta=None)
    with col3:
        my_requests = [r for r in data["requests"] if r["soldier_name"] == soldier_name]
        st.metric("Total Requests Submitted", len(my_requests))

    st.markdown("---")
    tab1, tab2 = st.tabs(["📋 Submit Leave Request", "📊 My Requests"])

    with tab1:
        st.subheader("Submit a New Leave Request")
        with st.form("leave_form"):
            start_date = st.date_input("Start Date", min_value=date.today())
            end_date = st.date_input("End Date", min_value=date.today())
            reason = st.text_area("Reason for Leave", placeholder="Describe your reason for leave...")
            submitted = st.form_submit_button("Submit Request", type="primary")
            if submitted:
                if end_date < start_date:
                    st.error("End date cannot be before start date.")
                elif not reason.strip():
                    st.error("Please provide a reason for your leave.")
                else:
                    overloaded_days = check_overlap_warning(data, soldier_name, start_date, end_date)
                    if overloaded_days:
                        formatted = [d.strftime("%b %d") for d in overloaded_days[:3]]
                        extra = f" (+{len(overloaded_days)-3} more)" if len(overloaded_days) > 3 else ""
                        st.warning(
                            f"⚠️ Warning: The following days already have {MAX_ON_LEAVE} soldiers on leave "
                            f"(only {MIN_ON_DUTY} on duty): {', '.join(formatted)}{extra}. "
                            "Your request will still be submitted but may be denied."
                        )
                    new_req = {
                        "id": get_next_id(data),
                        "soldier_name": soldier_name,
                        "start_date": str(start_date),
                        "end_date": str(end_date),
                        "reason": reason.strip(),
                        "status": "Pending",
                        "submitted_at": str(datetime.now().date()),
                    }
                    data["requests"].append(new_req)
                    save_data(data)
                    st.success("✅ Leave request submitted successfully!")
                    st.rerun()

    with tab2:
        st.subheader("My Leave Requests")
        my_requests = [r for r in data["requests"] if r["soldier_name"] == soldier_name]
        if not my_requests:
            st.info("You have no leave requests yet.")
        else:
            for r in sorted(my_requests, key=lambda x: x["submitted_at"], reverse=True):
                status_color = {"Approved": "🟢", "Denied": "🔴", "Pending": "🟡"}.get(r["status"], "⚪")
                with st.expander(f"{status_color} {r['start_date']} → {r['end_date']} | {r['status']}"):
                    days = (date.fromisoformat(r["end_date"]) - date.fromisoformat(r["start_date"])).days + 1
                    st.write(f"**Duration:** {days} day(s)")
                    st.write(f"**Reason:** {r['reason']}")
                    st.write(f"**Submitted:** {r['submitted_at']}")
                    if r.get("commander_note"):
                        st.write(f"**Commander Note:** {r['commander_note']}")


def commander_dashboard():
    data = load_data()
    st.title("🎖️ Commander Dashboard")

    tab1, tab2, tab3 = st.tabs(["📋 All Requests", "📅 Manpower Calendar", "📊 Overview"])

    with tab1:
        st.subheader("All Leave Requests")
        if not data["requests"]:
            st.info("No leave requests have been submitted yet.")
        else:
            filter_status = st.selectbox("Filter by Status", ["All", "Pending", "Approved", "Denied"])
            filtered = data["requests"] if filter_status == "All" else [r for r in data["requests"] if r["status"] == filter_status]
            filtered = sorted(filtered, key=lambda x: (x["status"] != "Pending", x["submitted_at"]), reverse=False)

            for r in filtered:
                status_color = {"Approved": "🟢", "Denied": "🔴", "Pending": "🟡"}.get(r["status"], "⚪")
                days = (date.fromisoformat(r["end_date"]) - date.fromisoformat(r["start_date"])).days + 1
                with st.expander(f"{status_color} #{r['id']} | {r['soldier_name']} | {r['start_date']} → {r['end_date']} ({days}d) | {r['status']}"):
                    st.write(f"**Reason:** {r['reason']}")
                    st.write(f"**Submitted:** {r['submitted_at']}")

                    overloaded_days = check_overlap_warning(data, r["soldier_name"], date.fromisoformat(r["start_date"]), date.fromisoformat(r["end_date"]))
                    if overloaded_days and r["status"] == "Pending":
                        formatted = [d.strftime("%b %d") for d in overloaded_days[:3]]
                        extra = f" (+{len(overloaded_days)-3} more)" if len(overloaded_days) > 3 else ""
                        st.warning(f"⚠️ Manpower Alert: Days already at max leave: {', '.join(formatted)}{extra}")

                    col_a, col_b, col_c = st.columns(3)
                    req_id = r["id"]

                    with col_a:
                        if st.button("✅ Approve", key=f"approve_{req_id}"):
                            for req in data["requests"]:
                                if req["id"] == req_id:
                                    req["status"] = "Approved"
                                    req["commander_note"] = ""
                                    break
                            save_data(data)
                            st.rerun()

                    with col_b:
                        if st.button("❌ Deny", key=f"deny_{req_id}"):
                            for req in data["requests"]:
                                if req["id"] == req_id:
                                    req["status"] = "Denied"
                                    break
                            save_data(data)
                            st.rerun()

                    with col_c:
                        if st.button("✏️ Edit Dates", key=f"edit_{req_id}"):
                            st.session_state[f"editing_{req_id}"] = True

                    if st.session_state.get(f"editing_{req_id}"):
                        st.markdown("**Edit Request Dates:**")
                        new_start = st.date_input("New Start Date", value=date.fromisoformat(r["start_date"]), key=f"nstart_{req_id}")
                        new_end = st.date_input("New End Date", value=date.fromisoformat(r["end_date"]), key=f"nend_{req_id}")
                        note = st.text_input("Commander Note (optional)", key=f"note_{req_id}")
                        col_save, col_cancel = st.columns(2)
                        with col_save:
                            if st.button("💾 Save Changes", key=f"save_{req_id}"):
                                if new_end >= new_start:
                                    for req in data["requests"]:
                                        if req["id"] == req_id:
                                            req["start_date"] = str(new_start)
                                            req["end_date"] = str(new_end)
                                            if note:
                                                req["commander_note"] = note
                                            break
                                    save_data(data)
                                    st.session_state[f"editing_{req_id}"] = False
                                    st.rerun()
                                else:
                                    st.error("End date must be after start date.")
                        with col_cancel:
                            if st.button("Cancel", key=f"cancel_{req_id}"):
                                st.session_state[f"editing_{req_id}"] = False
                                st.rerun()

    with tab2:
        st.subheader("Manpower Calendar (Next 60 Days)")
        today = date.today()
        end_cal = today + timedelta(days=60)
        day_counts = count_on_leave_per_day(data, today, end_cal)

        rows = []
        for d, on_leave in day_counts.items():
            on_duty = TOTAL_SOLDIERS - on_leave
            alert = on_leave > MAX_ON_LEAVE
            rows.append({
                "Date": d.strftime("%Y-%m-%d"),
                "Day": d.strftime("%a"),
                "On Leave": on_leave,
                "On Duty": on_duty,
                "Status": "🔴 ALERT" if alert else ("🟡 Warning" if on_leave >= 15 else "🟢 OK"),
            })

        df = pd.DataFrame(rows)

        alert_days = df[df["On Leave"] > MAX_ON_LEAVE]
        if not alert_days.empty:
            st.error(
                f"🔴 MANPOWER ALERT: {len(alert_days)} day(s) have more than {MAX_ON_LEAVE} soldiers on leave "
                f"(fewer than {MIN_ON_DUTY} on duty)!"
            )
            st.dataframe(
                alert_days[["Date", "Day", "On Leave", "On Duty", "Status"]],
                use_container_width=True,
                hide_index=True,
            )
            st.markdown("---")

        st.dataframe(
            df[["Date", "Day", "On Leave", "On Duty", "Status"]],
            use_container_width=True,
            hide_index=True,
            height=500,
        )

        st.markdown("---")
        st.caption(
            f"Threshold: If more than **{MAX_ON_LEAVE}** soldiers are on leave, "
            f"fewer than **{MIN_ON_DUTY}** remain on duty → 🔴 ALERT"
        )

    with tab3:
        st.subheader("Unit Overview")
        all_requests = data["requests"]
        pending = sum(1 for r in all_requests if r["status"] == "Pending")
        approved = sum(1 for r in all_requests if r["status"] == "Approved")
        denied = sum(1 for r in all_requests if r["status"] == "Denied")

        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Requests", len(all_requests))
        with col2:
            st.metric("Pending", pending)
        with col3:
            st.metric("Approved", approved)
        with col4:
            st.metric("Denied", denied)

        st.markdown("---")
        st.subheader("Leave Days by Soldier")
        soldier_data = []
        for s in SOLDIERS:
            used = days_used_by_soldier(data, s["name"])
            reqs = [r for r in all_requests if r["soldier_name"] == s["name"]]
            soldier_data.append({
                "Name": s["name"],
                "PKAL": s["pkal"],
                "Leave Days Used": used,
                "Requests": len(reqs),
            })
        soldier_df = pd.DataFrame(soldier_data)
        st.dataframe(soldier_df, use_container_width=True, hide_index=True)


def main():
    if "logged_in" not in st.session_state:
        st.session_state.logged_in = False

    if not st.session_state.logged_in:
        login_page()
        return

    with st.sidebar:
        st.markdown(f"**Logged in as:**  \n{st.session_state.soldier_name}")
        if st.session_state.role == "commander":
            st.badge("Commander", color="blue")
        else:
            st.badge("Soldier", color="green")
        st.markdown("---")
        days_to_end = (DEPLOYMENT_END - date.today()).days
        st.metric("Days to End of Deployment", days_to_end)
        st.caption(f"Deployment ends: {DEPLOYMENT_END.strftime('%b %d, %Y')}")
        st.markdown("---")
        if st.button("🚪 Logout", use_container_width=True):
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()

    if st.session_state.role == "commander":
        commander_dashboard()
    else:
        soldier_dashboard()


if __name__ == "__main__":
    main()
