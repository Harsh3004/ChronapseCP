<div align="center">

# 🏆 ChronapseCP

**Never miss a Contest again.**

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![Twilio](https://img.shields.io/badge/Twilio-F22F46?style=for-the-badge&logo=twilio&logoColor=white)](https://www.twilio.com/)
[![Google Calendar](https://img.shields.io/badge/Google_Calendar-4285F4?style=for-the-badge&logo=google-calendar&logoColor=white)](https://calendar.google.com/)

> An automated competitive programming contest tracker. It fetches upcoming **Codeforces**, **LeetCode**, and **CodeChef** contests, saves them to MongoDB, syncs them with your Google Calendar, and sends a **WhatsApp reminder** before they start.

---

</div>

## 🚀 Features

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>📅 Google Calendar Sync</h3>
      Automatically pushes new Codeforces, LeetCode, and CodeChef contests to your Google Calendar so you can block out time for your competitive programming sessions without manual data entry.
    </td>
    <td width="50%" valign="top">
      <h3>📱 WhatsApp Reminders</h3>
      Integrates with the Twilio Sandbox to fire off a formatted WhatsApp message with direct contest links when a contest is within 24 hours of starting.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🤖 Fully Automated (Twice Daily)</h3>
      Runs silently in the background at <b>08:00 AM & 08:00 PM IST</b> (02:30 & 14:30 UTC), eliminating redundant hourly polling and reducing runner compute by over 91%.
    </td>
    <td width="50%" valign="top">
      <h3>🧠 Smart Deduplication & Batching</h3>
      Leverages MongoDB Atlas with O(1) batch lookups to skip duplicate entries and ensure each contest reminder is dispatched exactly once (`notified: true`).
    </td>
  </tr>
</table>

---

## ⚙️ System Architecture

The orchestration script runs automatically. Here is how the data flows:

```text
  GitHub Actions
        │
        ▼
    index.js
        │
        ├─► Codeforces API  ──────────┐
        ├─► LeetCode GraphQL API ─────┼─ [1] Fault-tolerant parallel fetch
        ├─► CodeChef API ─────────────┘      (Promise.allSettled)
        │
        ├─► MongoDB Atlas   ──────────── [2] Batch Deduplicate (O(1) in-memory check)
        │
        ├─► Google Calendar API ──────── [3] Create calendar event for NEW contests
        │
        └─► Twilio WhatsApp Sandbox ──── [4] Send reminder if contest < 25h away 
                                             (Marks 'notified: true' to avoid spam)
```