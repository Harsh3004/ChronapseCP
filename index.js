import 'dotenv/config';
import axios from 'axios';
import mongoose from 'mongoose';
import twilio from 'twilio';
import { google } from 'googleapis';
import dns from 'dns';
import Contest from './database/Contest.js';

const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in ms

function buildContestId(platform, name, startTime) {
  const sanitised = name.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `${platform}_${sanitised}_${startTime.getTime()}`;
}

function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return google.calendar({ version: 'v3', auth });
}

async function connectDB() {
  // FORCE Node.js to use Google's Public DNS servers
  dns.setServers(['8.8.8.8', '8.8.4.4']);
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI environment variable is not set.');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  });

  console.log('✅ Connected to MongoDB Atlas.');
}

async function disconnectDB() {
  await mongoose.disconnect();
  console.log('✅ MongoDB connection closed.');
}

async function fetchCodeforces() {
  console.log('🌐 Fetching contests from official Codeforces API…');
  try {
    const response = await axios.get('https://codeforces.com/api/contest.list', { timeout: 15000 });

    if (response.data.status !== 'OK' || !Array.isArray(response.data.result)) {
      throw new Error('Unexpected Codeforces API response shape.');
    }

    const upcomingCF = response.data.result.filter(contest => contest.phase === 'BEFORE');
    const mappedCF = upcomingCF.map(c => ({
      name: c.name,
      site: 'CodeForces',
      start_time: new Date(c.startTimeSeconds * 1000).toISOString()
    }));

    console.log(`   └─ Received ${mappedCF.length} upcoming Codeforces contests.`);
    return mappedCF;
  } catch (error) {
    console.error(`   └─ ⚠️ Error fetching Codeforces: ${error.message}`);
    return []; 
  }
}

async function fetchLeetCode() {
  console.log('🌐 Fetching contests from LeetCode GraphQL API…');
  try {
    const response = await axios.post('https://leetcode.com/graphql', {
      query: `
        {
          allContests {
            title
            startTime
          }
        }
      `
    }, { timeout: 15000 });

    const contests = response.data.data.allContests;
    const nowSeconds = Math.floor(Date.now() / 1000);

    const upcomingLC = contests.filter(c => c.startTime > nowSeconds);

    const mappedLC = upcomingLC.map(c => ({
      name: c.title,
      site: 'LeetCode',
      start_time: new Date(c.startTime * 1000).toISOString() 
    }));

    console.log(`   └─ Received ${mappedLC.length} upcoming LeetCode contests.`);
    return mappedLC;
  } catch (error) {
    console.error(`   └─ ⚠️ Error fetching LeetCode: ${error.message}`);
    return []; 
  }
}

async function fetchContests() {
  const [cfContests, lcContests] = await Promise.all([
    fetchCodeforces(),
    fetchLeetCode()
  ]);

  const allContests = [...cfContests, ...lcContests];
  console.log(`✅ Combined total: ${allContests.length} upcoming contests fetched.`);
  
  return allContests;
}

function filterContests(contests) {
  const filtered = contests.filter((c) => {
    const site = (c.site || '').toLowerCase();
    return (
      site.includes('leetcode') ||
      site.includes('codeforces')
    );
  });

  console.log(`🔍 Filtered to ${filtered.length} LeetCode / CodeForces contests.`);
  return filtered;
}

function normaliseContest(raw) {
  try {
    const site = (raw.site || '').toLowerCase();
    const platform = site.includes('leetcode') ? 'LeetCode' : 'CodeForces';
    const name = (raw.name || '').trim();
    const startTime = new Date(raw.start_time);
    const endTime = raw.end_time ? new Date(raw.end_time) : null;
    const url = raw.url || '';

    if (!name) throw new Error('Contest name is empty.');
    if (isNaN(startTime.getTime())) throw new Error(`Invalid start_time: ${raw.start_time}`);
    if (startTime < new Date()) {
      return null;
    }

    return { platform, name, startTime, endTime, url };
  } catch (err) {
    console.warn(`   ⚠️  Skipping malformed contest entry: ${err.message}`);
    return null;
  }
}

async function createCalendarEvent(contest) {
  const calendar = getCalendarClient();
  const endTime = contest.endTime || new Date(contest.startTime.getTime() + 2 * 60 * 60 * 1000);

  const event = {
    summary: `🏆 ${contest.platform}: ${contest.name}`,
    description: [
      `Platform : ${contest.platform}`,
      `Contest  : ${contest.name}`,
      `Starts   : ${contest.startTime.toUTCString()}`,
      contest.url ? `URL      : ${contest.url}` : '',
      '',
      'Tracked automatically by ChronapseCP 🤖',
    ]
      .filter(Boolean)
      .join('\n'),
    start: {
      dateTime: contest.startTime.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'UTC',
    },
    reminders: {
      useDefault: false,
      overrides: [
        // 30-minute popup reminder
        { method: 'popup', minutes: 30 },
      ],
    },
    source: contest.url
      ? { title: `${contest.platform} Contest`, url: contest.url }
      : undefined,
  };

  const result = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: event,
  });

  return result.data.id;
}

async function sendWhatsAppReminder(contest) {
  const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

  const startFormatted = contest.startTime.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',  
    month: 'short',    
    day: 'numeric',    
    hour: 'numeric',   
    minute: '2-digit', 
    hour12: true       
  }) + ' IST';

  // The WhatsApp message
  const body = [
    '⏰ *ChronapseCP — Contest Reminder*',
    '━━━━━━━━━━━━━━━━━━━━━━',
    `🖥️  *Platform :* ${contest.platform}`,
    `🏆 *Contest  :* ${contest.name}`,
    `🕐 *Starts   :* ${startFormatted}`,
    '━━━━━━━━━━━━━━━━━━━━━━',
    '🚀 Contest starts in *less than 24 hours!*',
    'Get your IDE ready and good luck! 💪',
  ].join('\n');

  await client.messages.create({
    from: 'whatsapp:+14155238886',      // Twilio Sandbox number (fixed).
    to: `whatsapp:${process.env.MY_PHONE_NUMBER}`,
    body,
  });

  console.log(`   📲 WhatsApp reminder sent for: "${contest.name}"`);
}


async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  ChronapseCP — Hourly Sync Starting…');
  console.log(`  UTC Time: ${new Date().toUTCString()}`);
  console.log('═══════════════════════════════════════════\n');

  await connectDB();

  let newContests = 0;
  let remindersDispatched = 0;
  let skipped = 0;
  const errors = [];

  try {
    const rawContests = await fetchContests();
    const filtered = filterContests(rawContests);

    if (filtered.length === 0) {
      console.log('ℹ️  No upcoming LeetCode or CodeForces contests found. Exiting.');
      return;
    }

    const now = new Date();
    const reminderCutoff = new Date(now.getTime() + NOTIFICATION_WINDOW_MS);

    for (const raw of filtered) {
      const contest = normaliseContest(raw);

      if (!contest) {
        skipped++;
        continue;
      }

      const contestId = buildContestId(contest.platform, contest.name, contest.startTime);

      try {
        
        const existing = await Contest.findOne({ contestId });

        if (!existing) {
        
          console.log(`\n📅 NEW  | ${contest.platform}: ${contest.name}`);

          let calendarEventId = null;

          try {
            calendarEventId = await createCalendarEvent(contest);
            console.log(`   └─ 📆 Calendar event created (ID: ${calendarEventId})`);
          } catch (calErr) {
            console.error(`   └─ ⚠️  Calendar event creation failed: ${calErr.message}`);
            errors.push(`[Calendar] ${contest.name}: ${calErr.message}`);
          }

          await Contest.create({
            contestId,
            name: contest.name,
            platform: contest.platform,
            startTime: contest.startTime,
            calendarEventId,
            notified: false,
          });

          console.log(`   └─ 💾 Saved to MongoDB.`);
          newContests++;
        } else {
          const startsWithin24h =
            existing.startTime > now && existing.startTime <= reminderCutoff;

          if (startsWithin24h && !existing.notified) {
            console.log(`\n📲 REMIND | ${existing.platform}: ${existing.name}`);

            try {
              await sendWhatsAppReminder(existing);

              await Contest.updateOne(
                { contestId },
                { $set: { notified: true } }
              );

              console.log(`   └─ ✅ Marked as notified in MongoDB.`);
              remindersDispatched++;
            } catch (twilioErr) {
              console.error(`   └─ ❌ WhatsApp send failed: ${twilioErr.message}`);
              errors.push(`[Twilio] ${existing.name}: ${twilioErr.message}`);
            }
          } else {
            const reason = existing.notified
              ? 'already notified'
              : `starts at ${existing.startTime.toUTCString()} (outside 24h window)`;
            console.log(`   ⏩ SKIP | ${existing.platform}: ${existing.name} — ${reason}`);
          }
        }
      } catch (contestErr) {
        console.error(`\n❌ Error processing "${contest.name}": ${contestErr.message}`);
        errors.push(`[Contest] ${contest.name}: ${contestErr.message}`);
      }
    }
  } finally {
    await disconnectDB();
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  ChronapseCP — Run Complete');
  console.log('═══════════════════════════════════════════');
  console.log(`  🆕 New contests added  : ${newContests}`);
  console.log(`  📲 Reminders sent      : ${remindersDispatched}`);
  console.log(`  ⏩ Skipped             : ${skipped}`);

  if (errors.length > 0) {
    console.log(`\n  ⚠️  ${errors.length} non-fatal error(s) occurred:`);
    errors.forEach((e) => console.log(`     • ${e}`));
  } else {
    console.log('  ✅ No errors.');
  }
}

main().catch((err) => {
  console.error('\n🔥 FATAL ERROR — ChronapseCP crashed:');
  console.error(err);
  process.exitCode = 1;
});
