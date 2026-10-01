/**
 * Utilities for translating cron expressions to human-friendly text
 * and vice-versa, so normal users never have to write or see raw cron syntax.
 */

export function cronToHuman(cron) {
  if (!cron || typeof cron !== 'string') return 'Not scheduled';
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;

  const [min, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Every 15 minutes
  if (min === '*/15' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every 15 minutes';
  }
  // Every 30 minutes
  if (min === '*/30' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every 30 minutes';
  }
  // Every hour
  if (min === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every hour on the hour';
  }
  if (min.startsWith('*/') && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Every ${min.slice(2)} minutes`;
  }

  // Formatting hours and minutes
  const formatTime = (h, m) => {
    const numHour = parseInt(h, 10);
    const numMin = parseInt(m, 10);
    if (isNaN(numHour) || isNaN(numMin)) return `${h}:${m}`;
    const period = numHour >= 12 ? 'PM' : 'AM';
    const displayHour = numHour % 12 === 0 ? 12 : numHour % 12;
    const displayMin = numMin.toString().padStart(2, '0');
    return `${displayHour}:${displayMin} ${period}`;
  };

  // Daily at specific time
  if (dayOfMonth === '*' && month === '*') {
    if (dayOfWeek === '*') {
      return `Every day at ${formatTime(hour, min)}`;
    }
    if (dayOfWeek === '1-5' || dayOfWeek === 'MON-FRI') {
      return `Every weekday at ${formatTime(hour, min)}`;
    }
    if (dayOfWeek === '0,6' || dayOfWeek === '6,0' || dayOfWeek === 'SAT,SUN') {
      return `Every weekend at ${formatTime(hour, min)}`;
    }
    const days = {
      '0': 'Sunday',
      '1': 'Monday',
      '2': 'Tuesday',
      '3': 'Wednesday',
      '4': 'Thursday',
      '5': 'Friday',
      '6': 'Saturday',
      '7': 'Sunday',
    };
    if (days[dayOfWeek]) {
      return `Every ${days[dayOfWeek]} at ${formatTime(hour, min)}`;
    }
  }

  // Monthly
  if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    return `Monthly on day ${dayOfMonth} at ${formatTime(hour, min)}`;
  }

  return `Custom schedule (${cron})`;
}

export function humanToCron(preset, options = {}) {
  const { hour = 9, minute = 0, ampm = 'AM', days = 'all' } = options;
  
  let h = parseInt(hour, 10) || 0;
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  const m = parseInt(minute, 10) || 0;

  switch (preset) {
    case 'every_15_mins':
      return '*/15 * * * *';
    case 'every_hour':
      return '0 * * * *';
    case 'daily':
      return `${m} ${h} * * *`;
    case 'morning':
      return '0 8 * * *';
    case 'evening':
      return '0 19 * * *';
    case 'weekdays':
      return `${m} ${h} * * 1-5`;
    case 'weekly': {
      const dayNum = options.dayOfWeek || 1; // Monday default
      return `${m} ${h} * * ${dayNum}`;
    }
    case 'monthly':
      return `${m} ${h} 1 * *`;
    default:
      return `${m} ${h} * * *`;
  }
}

export function getNextRunEstimate(cron, active = true) {
  if (!active) return 'Paused';
  if (!cron) return 'Runs on demand';

  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return 'Pending trigger';

  const [min, hour, , , dayOfWeek] = parts;

  if (min.startsWith('*/')) {
    const mins = parseInt(min.slice(2), 10) || 15;
    return `In ~${mins} mins`;
  }
  if (min === '0' && hour === '*') {
    return 'Next hour';
  }

  const numHour = parseInt(hour, 10);
  const numMin = parseInt(min, 10);
  if (isNaN(numHour) || isNaN(numMin)) return 'Scheduled';

  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  const period = numHour >= 12 ? 'PM' : 'AM';
  const displayHour = numHour % 12 === 0 ? 12 : numHour % 12;
  const displayMin = numMin.toString().padStart(2, '0');
  const timeStr = `${displayHour}:${displayMin} ${period}`;

  if (dayOfWeek === '1-5') {
    const day = now.getDay();
    if (day >= 1 && day <= 5) {
      if (currentHour < numHour || (currentHour === numHour && currentMin < numMin)) {
        return `Today at ${timeStr}`;
      }
      return day === 5 ? `Monday at ${timeStr}` : `Tomorrow at ${timeStr}`;
    }
    return `Monday at ${timeStr}`;
  }

  if (currentHour < numHour || (currentHour === numHour && currentMin < numMin)) {
    return `Today at ${timeStr}`;
  }
  return `Tomorrow at ${timeStr}`;
}
