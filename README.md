<div align="center">

# 🏆 ChronapseCP

**Never miss a Contest again.**

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![Twilio](https://img.shields.io/badge/Twilio-F22F46?style=for-the-badge&logo=twilio&logoColor=white)](https://www.twilio.com/)
[![Google Calendar](https://img.shields.io/badge/Google_Calendar-4285F4?style=for-the-badge&logo=google-calendar&logoColor=white)](https://calendar.google.com/)

> An automated, **100% free** competitive programming contest tracker. It fetches upcoming **Codeforces** contests, saves them to MongoDB, syncs them with your Google Calendar, and sends a **WhatsApp reminder** 24 hours before they start — all powered by GitHub Actions.

---

</div>

## 🚀 Features

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>📅 Google Calendar Sync</h3>
      Automatically pushes new Codeforces contests to your Google Calendar so you can block out time for your competitive programming sessions without manual data entry.
    </td>
    <td width="50%" valign="top">
      <h3>📱 WhatsApp Reminders</h3>
      Integrates with the Twilio Sandbox to fire off a formatted WhatsApp message exactly when a contest is less than 24 hours away.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🤖 Fully Automated</h3>
      Runs silently in the background. A GitHub Actions CRON job wakes up at the top of every hour to keep everything perfectly in sync.
    </td>
    <td width="50%" valign="top">
      <h3>🧠 Smart Deduplication</h3>
      Leverages MongoDB Atlas to check if a contest has already been recorded or if a notification has already been sent (`notified: true`), preventing spam.
    </td>
  </tr>
</table>

---

## ⚙️ System Architecture

The orchestration script runs automatically. Here is how the data flows every hour:

```text
  GitHub Actions (CRON: Top of every hour)
        │
        ▼
    index.js
        │
        ├─► Codeforces API  ─────────── [1] Fetch upcoming contests
        │
        ├─► MongoDB Atlas   ─────────── [2] Deduplicate (skip if already in DB)
        │
        ├─► Google Calendar API ─────── [3] Create calendar event for NEW contests
        │
        └─► Twilio WhatsApp Sandbox ─── [4] Send reminder if contest < 24h away 
                                            (Marks 'notified: true' to avoid spam)