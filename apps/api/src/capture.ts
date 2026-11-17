import 'dotenv/config';
import cron from 'node-cron';
import { runBasicCapture } from './services/basic-capture.service.js';
import { ACTIVE_BASIC_CHAINS } from './services/basic-foods.js';

let active: Promise<void> | null = null;
function tick() {
  if (active) return active;
  active = (async () => {
    let failed = false;
    for (const chain of ACTIVE_BASIC_CHAINS) {
      try {
        const result = await runBasicCapture(chain);
        console.log('[Basic capture]', JSON.stringify({ chain, ...result }));
        if (result.status !== 'complete') failed = true;
      } catch (error) {
        console.error(`[Basic capture] ${chain} failed:`, error);
        failed = true;
      }
    }
    process.exitCode = failed ? 1 : 0;
  })().finally(() => { active = null; });
  return active;
}

if (process.argv.includes('--once')) {
  void tick().finally(async () => { const { prisma } = await import('@bossing/database'); await prisma.$disconnect(); });
} else {
  const eligible = () => Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23',
  }).format(new Date())) >= 4;
  const task = cron.schedule('0 * * * *', () => { if (eligible()) return tick(); }, {
    timezone: 'Europe/Madrid', noOverlap: true,
  });
  console.log('[Basic capture] Scheduler active: daily at 04:00 Europe/Madrid; hourly recovery checks.');
  if (eligible()) void tick();
  const shutdown = async () => {
    await task.stop();
    if (active) await active;
    const { prisma } = await import('@bossing/database');
    await prisma.$disconnect();
    process.exit();
  };
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
}