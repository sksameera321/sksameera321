const fs = require('fs');
const https = require('https');
const path = require('path');

const USERNAME = 'sksameera321';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

function fetchGraphQL(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'User-Agent': 'Node-Updater',
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function fetchREST(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Node-Updater',
        'Authorization': `Bearer ${TOKEN}`
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log(`[Updater] Fetching latest live GitHub contribution metrics for ${USERNAME}...`);

  const query = `
    query {
      user(login: "${USERNAME}") {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
                weekday
              }
            }
          }
        }
      }
    }
  `;

  const gqlRes = await fetchGraphQL(query);
  if (!gqlRes.data || !gqlRes.data.user) {
    throw new Error('Failed to fetch GraphQL data: ' + JSON.stringify(gqlRes));
  }

  const calendar = gqlRes.data.user.contributionsCollection.contributionCalendar;
  const total = calendar.totalContributions;
  const weeks = calendar.weeks;
  console.log(`[Updater] Live total contributions: ${total} across ${weeks.length} weeks.`);

  // 1. Generate contribution-calendar.svg
  generateCalendar(total, weeks);

  // 2. Generate contribution-skyline.svg
  generateSkyline(total, weeks);

  // 3. Generate contribution-wave.svg
  generateWave(total, weeks);

  console.log('[Updater] All visualizers updated dynamically from latest GitHub activity!');
}

function generateCalendar(total, weeks) {
  const width = 880;
  const height = 300;
  const cellPitch = 13.5;
  const cellSize = 10;
  const gridStartX = 65;
  const gridStartY = 95;

  function getCellColor(count) {
    if (count === 0) return '#181d26';
    if (count <= 3) return '#0284c7';
    if (count <= 10) return '#0ea5e9';
    if (count <= 30) return '#38bdf8';
    return '#7dd3fc';
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const months = [];
  let lastMonth = -1;

  weeks.forEach((week, wIdx) => {
    const firstDay = week.contributionDays[0];
    if (firstDay) {
      const d = new Date(firstDay.date);
      const m = d.getMonth();
      if (m !== lastMonth) {
        months.push({
          name: monthNames[m],
          x: gridStartX + (wIdx * cellPitch),
          isActive: m >= 6 && d.getFullYear() === 2026
        });
        lastMonth = m;
      }
    }
  });

  let cellsSvg = '';
  let glowCellsSvg = '';

  weeks.forEach((week, wIdx) => {
    week.contributionDays.forEach((day, dIdx) => {
      const x = gridStartX + (wIdx * cellPitch);
      const y = gridStartY + (day.weekday * cellPitch);
      const color = getCellColor(day.contributionCount);
      const isHighlight = day.contributionCount > 0;
      
      if (day.contributionCount > 5) {
        glowCellsSvg += `  <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2.5" fill="${color}" filter="url(#glow)" opacity="0.6" />\n`;
      }
      
      cellsSvg += `  <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2.5" fill="${color}" stroke="${isHighlight ? '#38bdf8' : '#1f2633'}" stroke-width="${isHighlight ? '0.8' : '0.4'}">
      <title>${day.date}: ${day.contributionCount} contribution${day.contributionCount === 1 ? '' : 's'}</title>
    </rect>\n`;
    });
  });

  let monthsSvg = '';
  months.forEach(m => {
    const fill = m.isActive ? '#38bdf8' : '#64748b';
    const weight = m.isActive ? '700' : '500';
    monthsSvg += `  <text x="${m.x}" y="${gridStartY - 10}" fill="${fill}" font-size="11" font-weight="${weight}" font-family="Inter, -apple-system, sans-serif">${m.name}</text>\n`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14171d"/>
      <stop offset="50%" stop-color="#101216"/>
      <stop offset="100%" stop-color="#0d0e12"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <style>
    .title { font: 700 16px Inter, -apple-system, sans-serif; fill: #f8fafc; }
    .subtitle { font: 400 12px Inter, -apple-system, sans-serif; fill: #94a3b8; }
    .badge-text { font: 600 11px Inter, -apple-system, sans-serif; fill: #38bdf8; }
    .weekday { font: 500 10px Inter, -apple-system, sans-serif; fill: #64748b; }
    .timeline-label { font: 600 11px Inter, -apple-system, sans-serif; fill: #94a3b8; }
    .timeline-sub { font: 400 10px Inter, -apple-system, sans-serif; fill: #64748b; }
    .pulse-dot { animation: pulse 2s infinite; }
    @keyframes pulse { 0% { r: 4px; opacity: 1; } 50% { r: 7px; opacity: 0.4; } 100% { r: 4px; opacity: 1; } }
  </style>

  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="14" fill="url(#bgGrad)" stroke="#1e293b" stroke-width="1.2" filter="url(#cardShadow)"/>

  <line x1="20" y1="65" x2="${width - 20}" y2="65" stroke="#1e293b" stroke-width="0.8" opacity="0.6"/>
  <line x1="20" y1="210" x2="${width - 20}" y2="210" stroke="#1e293b" stroke-width="0.8" opacity="0.6"/>

  <g transform="translate(30, 36)">
    <rect x="0" y="0" width="28" height="28" rx="7" fill="#0f172a" stroke="#0284c7" stroke-width="1"/>
    <path d="M6 14 L10 14 L13 8 L17 20 L20 11 L22 14" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="38" y="14" class="title">Engineering Contribution &amp; Velocity Activity</text>
    <text x="38" y="28" class="subtitle">Real-time public commit and pull request cadence across repositories</text>
  </g>

  <g transform="translate(${width - 365}, 28)">
    <rect x="0" y="0" width="165" height="26" rx="6" fill="#0f172a" stroke="#0284c7" stroke-width="0.8"/>
    <circle cx="12" cy="13" r="4" fill="#38bdf8" class="pulse-dot"/>
    <text x="24" y="17" class="badge-text"><tspan font-weight="800" fill="#f8fafc">${total}</tspan> Contributions</text>

    <rect x="175" y="0" width="160" height="26" rx="6" fill="#0f172a" stroke="#1e293b" stroke-width="0.8"/>
    <text x="187" y="17" class="badge-text" fill="#a5f3fc">4-Month Intensive Sprint</text>
  </g>

${monthsSvg}

  <text x="32" y="${gridStartY + (1 * cellPitch) + 8}" class="weekday">Mon</text>
  <text x="32" y="${gridStartY + (3 * cellPitch) + 8}" class="weekday">Wed</text>
  <text x="32" y="${gridStartY + (5 * cellPitch) + 8}" class="weekday">Fri</text>

  <g>
${glowCellsSvg}
${cellsSvg}
  </g>

  <g transform="translate(${width - 170}, ${gridStartY + (7 * cellPitch) + 5})">
    <text x="-32" y="9" class="weekday">Less</text>
    <rect x="0" y="0" width="9" height="9" rx="2" fill="#181d26" stroke="#1f2633" stroke-width="0.5"/>
    <rect x="13" y="0" width="9" height="9" rx="2" fill="#0284c7"/>
    <rect x="26" y="0" width="9" height="9" rx="2" fill="#0ea5e9"/>
    <rect x="39" y="0" width="9" height="9" rx="2" fill="#38bdf8"/>
    <rect x="52" y="0" width="9" height="9" rx="2" fill="#7dd3fc" filter="url(#glow)"/>
    <text x="68" y="9" class="weekday">More</text>
  </g>

  <g transform="translate(30, 230)">
    <circle cx="20" cy="18" r="5" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="35" y="15" class="timeline-label" fill="#f8fafc">July 2026: Origins</text>
    <text x="35" y="28" class="timeline-sub">First Commit &#8226; project-1 &#8226; 98% VIT Jr College</text>

    <circle cx="270" cy="18" r="5" fill="#0ea5e9" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="285" y="15" class="timeline-label" fill="#f8fafc">August 2026: Full-Stack Expansion</text>
    <text x="285" y="28" class="timeline-sub">Amazon Clone &#8226; Restaurant Ordering App</text>

    <circle cx="560" cy="18" r="5" fill="#38bdf8" stroke="#f8fafc" stroke-width="1.5" class="pulse-dot"/>
    <text x="575" y="15" class="timeline-label" fill="#38bdf8">November 2026: Peak Sprint</text>
    <text x="575" y="28" class="timeline-sub">Interactive Neumorphic Portfolio &#8226; ${total} Contributions</text>
  </g>
</svg>`;

  fs.writeFileSync(path.join(__dirname, '../contribution-calendar.svg'), svg, 'utf8');
}

function generateSkyline(total, weeks) {
  const svgWidth = 920;
  const svgHeight = 420;
  const originX = 140;
  const originY = 240;
  const vx_w = 13.5;
  const vy_w = -2.8;
  const vx_d = -8.5;
  const vy_d = 5.2;

  function getBuildingHeight(count) {
    if (count === 0) return 3;
    if (count <= 2) return 18;
    if (count <= 5) return 38;
    if (count <= 15) return 65;
    if (count <= 40) return 95;
    return 145;
  }

  function getBuildingColors(count) {
    if (count === 0) return { top: '#181d26', left: '#12161e', right: '#0f1218', stroke: '#1e2633', windowGlow: false };
    if (count <= 2) return { top: '#0284c7', left: '#0369a1', right: '#075985', stroke: '#38bdf8', windowGlow: true, windowColor: '#7dd3fc' };
    if (count <= 5) return { top: '#0ea5e9', left: '#0284c7', right: '#0369a1', stroke: '#7dd3fc', windowGlow: true, windowColor: '#bae6fd' };
    if (count <= 20) return { top: '#38bdf8', left: '#0ea5e9', right: '#0284c7', stroke: '#e0f2fe', windowGlow: true, windowColor: '#ffffff' };
    return { top: '#7dd3fc', left: '#38bdf8', right: '#0284c7', stroke: '#ffffff', windowGlow: true, windowColor: '#ffffff', spire: true };
  }

  const blocks = [];
  weeks.forEach((week, wIdx) => {
    week.contributionDays.forEach((day, dIdx) => {
      const xBase = originX + (wIdx * vx_w) + (day.weekday * vx_d);
      const yBase = originY + (wIdx * vy_w) + (day.weekday * vy_d);
      const h = getBuildingHeight(day.contributionCount);
      const colors = getBuildingColors(day.contributionCount);
      const depth = (wIdx * 10) + day.weekday;
      blocks.push({ wIdx, dIdx: day.weekday, date: day.date, count: day.contributionCount, x: xBase, y: yBase, h, colors, depth });
    });
  });

  blocks.sort((a, b) => a.depth - b.depth);

  let buildingsSvg = '';
  blocks.forEach(b => {
    const x = b.x; const y = b.y; const h = b.h; const c = b.colors;
    const wL = 6.5; const wR = 8.5; const dY = 4.2;
    const p0_x = x; const p0_y = y - h;
    const p1_x = x + wR; const p1_y = y - h + dY * 0.6;
    const p2_x = x + wR - wL; const p2_y = y - h + dY * 1.5;
    const p3_x = x - wL; const p3_y = y - h + dY * 0.9;
    const gb1_y = y + dY * 0.6; const gb2_y = y + dY * 1.5; const gb3_y = y + dY * 0.9;
    
    buildingsSvg += `  <g class="building">
    <polygon points="${p2_x},${p2_y} ${p1_x},${p1_y} ${p1_x},${gb1_y} ${p2_x},${gb2_y}" fill="${c.right}" stroke="${c.stroke}" stroke-width="0.3" />
    <polygon points="${p3_x},${p3_y} ${p2_x},${p2_y} ${p2_x},${gb2_y} ${p3_x},${gb3_y}" fill="${c.left}" stroke="${c.stroke}" stroke-width="0.3" />
    <polygon points="${p0_x},${p0_y} ${p1_x},${p1_y} ${p2_x},${p2_y} ${p3_x},${p3_y}" fill="${c.top}" stroke="${c.stroke}" stroke-width="0.5" />\n`;

    if (b.h > 25 && b.count > 0) {
      const numFloors = Math.floor(b.h / 12);
      for (let f = 1; f <= numFloors; f++) {
        const winY = y - (f * 10);
        buildingsSvg += `    <circle cx="${p2_x - 3}" cy="${winY + 2}" r="0.9" fill="${c.windowColor}" opacity="0.8"/>\n`;
        buildingsSvg += `    <circle cx="${p2_x + 3}" cy="${winY + 1}" r="0.9" fill="${c.windowColor}" opacity="0.9"/>\n`;
      }
    }

    if (c.spire) {
      buildingsSvg += `    <line x1="${p0_x}" y1="${p0_y}" x2="${p0_x}" y2="${p0_y - 25}" stroke="#ffffff" stroke-width="1.2" />
    <circle cx="${p0_x}" cy="${p0_y - 26}" r="3" fill="#38bdf8" filter="url(#beaconGlow)" />
    <circle cx="${p0_x}" cy="${p0_y - 26}" r="1.5" fill="#ffffff" />\n`;
    }

    buildingsSvg += `  </g>\n`;
  });

  const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
  <defs>
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0b0d13"/>
      <stop offset="60%" stop-color="#11151f"/>
      <stop offset="100%" stop-color="#141a27"/>
    </linearGradient>
    <filter id="beaconGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <style>
    .title { font: 700 17px Inter, -apple-system, sans-serif; fill: #f8fafc; }
    .subtitle { font: 400 12px Inter, -apple-system, sans-serif; fill: #94a3b8; }
    .badge-pill { font: 600 11px Inter, -apple-system, sans-serif; fill: #38bdf8; }
    .metric-number { font: 800 13px Inter, -apple-system, sans-serif; fill: #ffffff; }
    .sky-label { font: 600 11px Inter, -apple-system, sans-serif; fill: #64748b; }
    .city-zone { font: 700 11px Inter, -apple-system, sans-serif; fill: #38bdf8; }
  </style>

  <rect x="2" y="2" width="${svgWidth - 4}" height="${svgHeight - 4}" rx="16" fill="url(#skyGrad)" stroke="#1e293b" stroke-width="1.2"/>

  <g transform="translate(32, 36)">
    <rect x="0" y="0" width="30" height="30" rx="8" fill="#0f172a" stroke="#0284c7" stroke-width="1"/>
    <path d="M7 24 V9 L15 5 V24 M15 13 L23 10 V24 M10 13 H12 M10 17 H12 M18 16 H20 M18 20 H20" fill="none" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="42" y="15" class="title">The Contribution Skyline &#8226; 3D Isometric Metropolis</text>
    <text x="42" y="29" class="subtitle">Every commit raises a neon tower &#8212; from ground zero in July to peak skyline in November</text>
  </g>

  <g transform="translate(${svgWidth - 360}, 28)">
    <rect x="0" y="0" width="165" height="28" rx="6" fill="#0f172a" stroke="#0284c7" stroke-width="0.8"/>
    <circle cx="14" cy="14" r="4" fill="#38bdf8"/>
    <text x="26" y="19" class="badge-pill"><tspan class="metric-number">${total}</tspan> Commits Shipped</text>

    <rect x="175" y="0" width="155" height="28" rx="6" fill="#0f172a" stroke="#1e293b" stroke-width="0.8"/>
    <text x="187" y="19" class="badge-pill" fill="#bae6fd">4-Month City Riser</text>
  </g>

  <line x1="30" y1="365" x2="${svgWidth - 30}" y2="365" stroke="#1e293b" stroke-width="0.8" opacity="0.6"/>

  <g>
${buildingsSvg}
  </g>

  <g transform="translate(130, 390)">
    <circle cx="0" cy="0" r="3.5" fill="#64748b" />
    <text x="10" y="4" class="sky-label">Nov 2025 &#8211; Jun 2026: Foundation &amp; Pre-University</text>
  </g>

  <g transform="translate(540, 390)">
    <circle cx="0" cy="0" r="4" fill="#0284c7" />
    <text x="10" y="4" class="city-zone">Jul 2026: First High-Rise (project-1)</text>
  </g>

  <g transform="translate(${svgWidth - 210}, 390)">
    <circle cx="0" cy="0" r="4" fill="#38bdf8" />
    <text x="10" y="4" class="city-zone" fill="#7dd3fc">Peak Skyscraper (${total} Commits)</text>
  </g>
</svg>`;

  fs.writeFileSync(path.join(__dirname, '../contribution-skyline.svg'), finalSvg, 'utf8');
}

function generateWave(total, weeks) {
  const width = 920;
  const height = 420;
  const weeklyTotals = weeks.map(w => w.contributionDays.reduce((acc, d) => acc + d.contributionCount, 0));
  const numWeeks = weeklyTotals.length;
  const startX = 50;
  const endX = width - 50;
  const stepX = (endX - startX) / (numWeeks - 1);
  const baselineY = 320;

  const heights = weeklyTotals.map((tot, i) => {
    if (tot === 0) return 8 + Math.sin(i * 0.45) * 5;
    if (tot <= 3) return 30 + (tot * 5);
    if (tot <= 10) return 60 + (tot * 4);
    if (tot <= 30) return 110 + (tot * 2);
    return 190;
  });

  function generateWavePath(heightsArr, phaseOffset, amplitudeMod, yShift) {
    const points = heightsArr.map((h, i) => {
      const x = startX + (i * stepX);
      const harmonic = Math.sin((i * 0.4) + phaseOffset) * (8 * amplitudeMod);
      const y = (baselineY + yShift) - (h * amplitudeMod) + harmonic;
      return { x, y };
    });

    let d = `M ${startX} ${baselineY + 40} L ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]; const p1 = points[i + 1]; const mx = (p0.x + p1.x) / 2;
      d += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    d += ` L ${endX} ${baselineY + 40} Z`;
    return { d, points };
  }

  const waveLayer1 = generateWavePath(heights, 0, 0.45, 15);
  const waveLayer2 = generateWavePath(heights, 1.2, 0.70, 8);
  const waveLayer3 = generateWavePath(heights, 2.4, 0.90, 0);
  const waveLayer4 = generateWavePath(heights, 0.5, 1.05, -5);

  let foamParticles = '';
  for (let p = 0; p < 45; p++) {
    const px = endX - 110 + (Math.sin(p * 3.7) * 75);
    const py = 120 + (Math.cos(p * 5.1) * 50);
    const r = 0.8 + (Math.sin(p * 9.2) * 1.4);
    const op = 0.3 + (Math.sin(p * 2.3) * 0.5);
    foamParticles += `    <circle cx="${px}" cy="${py}" r="${Math.abs(r)}" fill="#ffffff" opacity="${Math.abs(op)}" filter="url(#glow)"/>\n`;
  }

  const waveSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="oceanBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#080c14"/>
      <stop offset="45%" stop-color="#0b1322"/>
      <stop offset="100%" stop-color="#0f1f33"/>
    </linearGradient>
    <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#082f49" stop-opacity="0.6"/>
      <stop offset="60%" stop-color="#0369a1" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0.8"/>
    </linearGradient>
    <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#075985" stop-opacity="0.5"/>
      <stop offset="65%" stop-color="#0284c7" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.85"/>
    </linearGradient>
    <linearGradient id="waveGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0369a1" stop-opacity="0.4"/>
      <stop offset="70%" stop-color="#0ea5e9" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="crestGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284c7" stop-opacity="0.3"/>
      <stop offset="75%" stop-color="#38bdf8" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#bae6fd" stop-opacity="1"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <style>
    .title { font: 700 17px Inter, -apple-system, sans-serif; fill: #f8fafc; }
    .subtitle { font: 400 12px Inter, -apple-system, sans-serif; fill: #94a3b8; }
    .badge-pill { font: 600 11px Inter, -apple-system, sans-serif; fill: #38bdf8; }
    .metric-number { font: 800 13px Inter, -apple-system, sans-serif; fill: #ffffff; }
    .wave-label { font: 600 11px Inter, -apple-system, sans-serif; fill: #64748b; }
    .wave-highlight { font: 700 11px Inter, -apple-system, sans-serif; fill: #38bdf8; }
  </style>

  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="16" fill="url(#oceanBg)" stroke="#1e293b" stroke-width="1.2"/>

  <g transform="translate(32, 36)">
    <rect x="0" y="0" width="30" height="30" rx="8" fill="#0f172a" stroke="#0284c7" stroke-width="1"/>
    <path d="M5 16 C8 13, 11 13, 14 16 C17 19, 20 19, 25 16 M5 21 C8 18, 11 18, 14 21 C17 24, 20 24, 25 21" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
    <text x="42" y="15" class="title">The Contribution Ocean Wave &#8226; Hydrodynamic Flow</text>
    <text x="42" y="29" class="subtitle">Git commit momentum visualized as fluid wave harmonics &#8212; gentle pre-university swell into a surging tidal wave</text>
  </g>

  <g transform="translate(${width - 360}, 28)">
    <rect x="0" y="0" width="165" height="28" rx="6" fill="#0f172a" stroke="#0284c7" stroke-width="0.8"/>
    <circle cx="14" cy="14" r="4" fill="#38bdf8"/>
    <text x="26" y="19" class="badge-pill"><tspan class="metric-number">${total}</tspan> Tidal Surge Commits</text>

    <rect x="175" y="0" width="155" height="28" rx="6" fill="#0f172a" stroke="#1e293b" stroke-width="0.8"/>
    <text x="187" y="19" class="badge-pill" fill="#bae6fd">4-Month Ocean Swell</text>
  </g>

  <path d="${waveLayer1.d}" fill="url(#waveGrad1)" />
  <path d="${waveLayer2.d}" fill="url(#waveGrad2)" />
  <path d="${waveLayer3.d}" fill="url(#waveGrad3)" />
  <path d="${waveLayer4.d}" fill="url(#crestGrad)" />

  <path d="${waveLayer4.d.split('L ' + endX)[0]}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.9" filter="url(#glow)"/>
  <path d="${waveLayer3.d.split('L ' + endX)[0]}" fill="none" stroke="#7dd3fc" stroke-width="1.2" opacity="0.7"/>

  <g>
${foamParticles}
  </g>

  <g transform="translate(${endX - 30}, 115)">
    <circle cx="0" cy="0" r="16" fill="#38bdf8" opacity="0.15" filter="url(#glow)"/>
    <circle cx="0" cy="0" r="6" fill="#38bdf8" filter="url(#glow)"/>
    <circle cx="0" cy="0" r="3" fill="#ffffff"/>
    <text x="-65" y="-14" class="wave-highlight" text-anchor="middle" font-size="12">Peak Crest</text>
  </g>

  <line x1="30" y1="365" x2="${width - 30}" y2="365" stroke="#1e293b" stroke-width="0.8" opacity="0.6"/>

  <g transform="translate(130, 390)">
    <circle cx="0" cy="0" r="3.5" fill="#64748b" />
    <text x="10" y="4" class="wave-label">Nov 2025 &#8211; Jun 2026: Calm Ocean Waters (Academics &amp; VIT Jr College 98%)</text>
  </g>

  <g transform="translate(560, 390)">
    <circle cx="0" cy="0" r="4" fill="#0284c7" />
    <text x="10" y="4" class="wave-highlight">Jul 2026: The Swell Awakens (project-1)</text>
  </g>

  <g transform="translate(${width - 200}, 390)">
    <circle cx="0" cy="0" r="4" fill="#38bdf8" />
    <text x="10" y="4" class="wave-highlight" fill="#7dd3fc">Peak Tidal Crest (${total} Commits)</text>
  </g>
</svg>`;

  fs.writeFileSync(path.join(__dirname, '../contribution-wave.svg'), waveSvg, 'utf8');
}

main().catch(err => {
  console.error('[Updater Error]', err);
  process.exit(1);
});
