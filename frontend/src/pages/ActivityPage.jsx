import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchActivityByNumber } from "../api/activityOverviewApi";
import "../styles/sales-analysis-report.css";
import "../styles/activity-overview-report.css";

const EMPTY_ACTIVITY = {
  number: "",
  activity: "Task",
  activityType: "General",
  subject: "",
  assignedToType: "User",
  assignedToName: "",
  assignedBy: "",
  personal: true,
  remarks: "",
  startDateDisplay: "",
  startTime: "",
  endDateDisplay: "",
  endTime: "",
  duration: "",
  status: "Not Started",
  recurrence: "None",
  priority: "High",
  meetingLocation: "",
  reminder: true,
  reminderText: "15 Minutes",
  inactive: false,
  closed: false,
  bpCode: "",
  bpName: "",
  contactPerson: "",
  telephoneNo: "",
};

function ActivityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activityNo = searchParams.get("activityNo") || "";
  const [activity, setActivity] = useState(EMPTY_ACTIVITY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activityNo) {
      setActivity(EMPTY_ACTIVITY);
      return;
    }

    let ignore = false;
    setLoading(true);
    setError("");
    fetchActivityByNumber(activityNo)
      .then((data) => {
        if (!ignore) setActivity({ ...EMPTY_ACTIVITY, ...(data || {}) });
      })
      .catch((loadError) => {
        if (!ignore) {
          setActivity({ ...EMPTY_ACTIVITY, number: activityNo });
          setError(loadError?.response?.data?.message || "Could not load activity.");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => { ignore = true; };
  }, [activityNo]);

  const openBusinessPartner = () => {
    const code = String(activity.bpCode || "").trim();
    if (!code) return;
    navigate(`/business-partner?cardCode=${encodeURIComponent(code)}`);
  };

  return (
    <div className="activity-page">
      <section className="activity-window sap-report-window">
        <header className="sales-analysis-window__titlebar sap-report-titlebar activity-window__titlebar">
          <span className="sales-analysis-window__title sap-report-title">Activity</span>
          <div className="sales-analysis-window__controls">
            <button type="button" aria-label="Minimize" onClick={() => navigate("/dashboard")}>-</button>
            <button type="button" aria-label="Restore">[]</button>
            <button type="button" aria-label="Close" onClick={() => navigate(-1)}>x</button>
          </div>
        </header>
        <div className="sales-analysis-window__accent" />

        <div className="activity-form">
          <div className="activity-form__top">
            <div className="activity-form__left-fields">
              <label>Activity</label>
              <select value={activity.activity} readOnly>
                <option>{activity.activity}</option>
              </select>
              <label>Type</label>
              <select value={activity.activityType} readOnly>
                <option>{activity.activityType}</option>
              </select>
              <label>Subject</label>
              <select value={activity.subject} readOnly>
                <option>{activity.subject}</option>
              </select>
              <label>Assigned To</label>
              <div className="activity-form__assigned">
                <span className="activity-form__arrow">-&gt;</span>
                <select value={activity.assignedToType} readOnly><option>{activity.assignedToType}</option></select>
                <select value={activity.assignedToName} readOnly><option>{activity.assignedToName}</option></select>
              </div>
              <label>Assigned By</label>
              <input value={activity.assignedBy} readOnly />
              <label />
              <label className="activity-form__checkbox">
                <input type="checkbox" checked={activity.personal} readOnly />
                <span>Personal</span>
              </label>
            </div>

            <div className="activity-form__right-fields">
              <label>Number</label>
              <input value={activity.number} readOnly />
              <label>BP Code</label>
              <div className="activity-form__bp-field">
                <input value={activity.bpCode} readOnly />
                <button type="button" onClick={openBusinessPartner} disabled={!activity.bpCode}>...</button>
              </div>
              <label>BP Name</label>
              <button
                type="button"
                className="activity-form__link-input"
                onClick={openBusinessPartner}
                disabled={!activity.bpCode}
              >
                {activity.bpName}
              </button>
              <label>Contact Person</label>
              <button
                type="button"
                className="activity-form__link-input"
                onClick={openBusinessPartner}
                disabled={!activity.bpCode}
              >
                {activity.contactPerson}
              </button>
              <label>Telephone No.</label>
              <input value={activity.telephoneNo} readOnly />
            </div>
          </div>

          <div className="activity-tabs">
            <button type="button" className="is-active">General</button>
            <button type="button">Content</button>
            <button type="button">Linked Document</button>
            <button type="button">Attachments</button>
          </div>

          <div className="activity-general-panel">
            <div className="activity-general-panel__left">
              <label>Remarks</label>
              <input className="activity-form__remarks" value={activity.remarks} readOnly />
              <label>Start Time</label>
              <div className="activity-form__date-time">
                <input value={activity.startDateDisplay} readOnly />
                <input value={activity.startTime} readOnly />
              </div>
              <label>End Time</label>
              <div className="activity-form__date-time">
                <input value={activity.endDateDisplay} readOnly />
                <input value={activity.endTime} readOnly />
              </div>
              <label>Duration</label>
              <input value={activity.duration} readOnly />
              <label>Status</label>
              <select value={activity.status} readOnly><option>{activity.status}</option></select>
            </div>

            <div className="activity-general-panel__right">
              <label>Priority</label>
              <select value={activity.priority} readOnly><option>{activity.priority}</option></select>
              <label>Meeting Location</label>
              <select value={activity.meetingLocation} readOnly><option>{activity.meetingLocation}</option></select>
            </div>

            <div className="activity-general-panel__bottom-left">
              <label>Recurrence</label>
              <select value={activity.recurrence} readOnly><option>{activity.recurrence}</option></select>
            </div>

            <div className="activity-general-panel__bottom-checks">
              <label className="activity-form__checkbox">
                <input type="checkbox" checked={activity.inactive} readOnly />
                <span>Inactive</span>
              </label>
              <label className="activity-form__checkbox">
                <input type="checkbox" checked={activity.closed} readOnly />
                <span>Closed</span>
              </label>
            </div>
          </div>

          {loading ? <div className="activity-form__status">Loading activity...</div> : null}
          {error ? <div className="activity-form__status is-error">{error}</div> : null}

          <div className="activity-form__bottom">
            <label className="activity-form__checkbox">
              <input type="checkbox" checked={activity.reminder} readOnly />
              <span>Reminder</span>
            </label>
            <input value={activity.reminderText} readOnly />
            <button type="button" className="sales-analysis__sap-btn activity-form__follow-up">Follow Up</button>
          </div>

          <footer className="activity-form__footer">
            <button type="button" className="sales-analysis__sap-btn" onClick={() => navigate(-1)}>OK</button>
            <button type="button" className="sales-analysis__sap-btn" onClick={() => navigate(-1)}>Cancel</button>
          </footer>
        </div>
      </section>
    </div>
  );
}

export default ActivityPage;
