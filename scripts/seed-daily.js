import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const DARES = [
  { text: "Send a voice note to someone you've never talked to", category: "social" },
  { text: "Tell your next match one thing you find attractive about them", category: "flirty" },
  { text: "Post an anonymous confession right now", category: "bold" },
  { text: "Compliment someone's photo today", category: "social" },
  { text: "Start a conversation with someone who's 'Available Now'", category: "flirty" },
  { text: "Share your most adventurous fantasy in Confessions", category: "bold" },
  { text: "Say hi to 3 new people today", category: "social" },
  { text: "Send a quick reply to someone in your chat list", category: "chill" },
  { text: "Post what you're looking for tonight in your status", category: "flirty" },
  { text: "React to at least 5 confessions", category: "chill" },
  { text: "Send someone a voice note instead of text", category: "social" },
  { text: "Be honest in your next conversation — no games", category: "bold" },
  { text: "Check out who's online in your area right now", category: "chill" },
  { text: "Reply to a Community post you normally wouldn't", category: "social" },
];

const HOT_TAKES = [
  { question: "Sleepover or one-night stand?", option_a: "Sleepover", option_b: "One-night stand" },
  { question: "Looks or personality?", option_a: "Looks", option_b: "Personality" },
  { question: "Dominant or submissive?", option_a: "Dominant", option_b: "Submissive" },
  { question: "Shower or bed?", option_a: "Shower", option_b: "Bed" },
  { question: "Morning or night?", option_a: "Morning", option_b: "Night" },
  { question: "Kissing or cuddling?", option_a: "Kissing", option_b: "Cuddling" },
  { question: "Car or hotel?", option_a: "Car", option_b: "Hotel" },
  { question: "Text first or wait?", option_a: "Text first", option_b: "Wait for them" },
  { question: "Older or younger?", option_a: "Older", option_b: "Younger" },
  { question: "Spontaneous or planned?", option_a: "Spontaneous", option_b: "Planned" },
  { question: "Public or private?", option_a: "Public", option_b: "Private" },
  { question: "Voice note or text?", option_a: "Voice note", option_b: "Text" },
  { question: "Video call or chat?", option_a: "Video call", option_b: "Chat only" },
  { question: "Commitment or freedom?", option_a: "Commitment", option_b: "Freedom" },
];

async function seed() {
  const today = new Date().toISOString().split('T')[0];
  
  // Seed today's dare
  const dareIndex = Math.floor(Math.random() * DARES.length);
  const dare = DARES[dareIndex];
  
  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO DailyDare (id, text, category, date, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [`dd_${today}`, dare.text, dare.category, today],
    });
    console.log(`✅ DailyDare seeded for ${today}: ${dare.text}`);
  } catch (e) {
    console.log(`⏭️ DailyDare already exists for ${today}`);
  }
  
  // Seed today's hot take
  const htIndex = Math.floor(Math.random() * HOT_TAKES.length);
  const ht = HOT_TAKES[htIndex];
  
  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO HotTake (id, question, option_a, option_b, votes_a, votes_b, date, created_at) VALUES (?, ?, ?, ?, 0, 0, ?, datetime('now'))`,
      args: [`ht_${today}`, ht.question, ht.option_a, ht.option_b, today],
    });
    console.log(`✅ HotTake seeded for ${today}: ${ht.question}`);
  } catch (e) {
    console.log(`⏭️ HotTake already exists for ${today}`);
  }
  
  console.log('\n🎉 Daily engagement seeded!');
}

seed().catch(console.error);
