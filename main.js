import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { hexbin as d3Hexbin } from 'https://cdn.jsdelivr.net/npm/d3-hexbin@0.2.2/+esm';

const width = 500;
const height = 470;

const x = d3.scaleLinear().domain([-25, 25]).range([0, width]);
const y = d3.scaleLinear().domain([0, 47]).range([0, height]);

const hoop = { x: 0, y: 5.25 };
const threeRadius = 23.75;
const cornerX = 22;

const zoneOrder = ['Rim', 'Short paint', 'Midrange', 'Corner 3', 'Above-break 3'];
const zoneColor = d3
  .scaleOrdinal()
  .domain(zoneOrder)
  .range(['#d55e00', '#e69f00', '#cc79a7', '#56b4e9', '#0072b2']);

function arcPoints(cx, cy, r, start, end) {
  return d3.range(0, 1.0001, 0.01).map((t) => {
    const a = start + t * (end - start);
    return [x(cx + r * Math.cos(a)), y(cy + r * Math.sin(a))];
  });
}

const line = d3.line();

const svg = d3
  .select('#court')
  .append('svg')
  .attr('viewBox', `-4 -26 ${width + 8} ${height + 30}`);

const court = svg.append('g').attr('class', 'court-lines');
const hexLayer = svg.append('g').attr('class', 'hexes');
const topLines = svg.append('g').attr('class', 'court-lines');

court
  .append('rect')
  .attr('class', 'floor')
  .attr('x', x(-25))
  .attr('y', y(0))
  .attr('width', x(25) - x(-25))
  .attr('height', y(47) - y(0));

court
  .append('rect')
  .attr('class', 'paint')
  .attr('x', x(-8))
  .attr('y', y(0))
  .attr('width', x(8) - x(-8))
  .attr('height', y(19) - y(0));

court.append('path').attr('d', line(arcPoints(0, 19, 6, 0, Math.PI)));

court
  .append('path')
  .attr('class', 'dashed')
  .attr('d', line(arcPoints(0, 19, 6, Math.PI, 2 * Math.PI)));

court.append('path').attr('d', line(arcPoints(hoop.x, hoop.y, 4, 0, Math.PI)));

const cornerAngle = Math.acos(cornerX / threeRadius);
const threePoints = [
  [x(cornerX), y(0)],
  ...arcPoints(hoop.x, hoop.y, threeRadius, cornerAngle, Math.PI - cornerAngle),
  [x(-cornerX), y(0)],
];
court.append('path').attr('d', line(threePoints));

court.append('path').attr('d', line(arcPoints(0, 47, 6, Math.PI, 2 * Math.PI)));

topLines
  .append('line')
  .attr('class', 'backboard')
  .attr('x1', x(-3))
  .attr('x2', x(3))
  .attr('y1', y(4))
  .attr('y2', y(4));

topLines
  .append('circle')
  .attr('class', 'rim')
  .attr('cx', x(hoop.x))
  .attr('cy', y(hoop.y))
  .attr('r', x(0.75) - x(0));

const grid = await d3.csv('data/shot_grid.csv', d3.autoType);
const zoneRows = await d3.csv('data/zones_by_season.csv', d3.autoType);
const teamGames = await d3.csv('data/team_games.csv', d3.autoType);
const gamesBySeason = new Map(teamGames.map((d) => [d.season, d.team_games]));

const hexRadius = 15;
const hexbin = d3Hexbin()
  .x((d) => x(d.x))
  .y((d) => y(d.y))
  .radius(hexRadius)
  .extent([
    [0, 0],
    [width, height],
  ]);

function binsForSeason(season) {
  const games = gamesBySeason.get(season);
  return hexbin(grid.filter((d) => d.season === season))
    .map((bin) => {
      const shots = d3.sum(bin, (d) => d.shots);
      const byZone = d3.rollups(
        bin,
        (v) => d3.sum(v, (d) => d.shots),
        (d) => d.zone,
      );
      return {
        key: `${Math.round(bin.x)},${Math.round(bin.y)}`,
        x: bin.x,
        y: bin.y,
        shots,
        perGame: shots / games,
        fg: d3.sum(bin, (d) => d.makes) / shots,
        pps: d3.sum(bin, (d) => d.points) / shots,
        zone: d3.greatest(byZone, (d) => d[1])[0],
      };
    })
    .filter((d) => d.perGame >= 0.02);
}

const seasons = d3.range(2004, 2026);
const allBins = new Map(seasons.map((s) => [s, binsForSeason(s)]));
const capPerGame = d3.quantile(
  [...allBins.values()]
    .flat()
    .map((d) => d.perGame)
    .sort(d3.ascending),
  0.98,
);
const size = d3.scaleSqrt().domain([0, capPerGame]).range([0, hexRadius]).clamp(true);

const ppsBins = [0.8, 0.95, 1.1, 1.25];
const ppsColor = d3
  .scaleThreshold()
  .domain(ppsBins)
  .range(['#b2182b', '#ef8a62', '#fddbc7', '#67a9cf', '#2166ac']);
const ppsLabels = ['Under 0.80', '0.80 to 0.95', '0.95 to 1.10', '1.10 to 1.25', '1.25 and up'];

let colorMode = 'zone';

function hexColor(d) {
  return colorMode === 'zone' ? zoneColor(d.zone) : ppsColor(d.pps);
}

const shareBySeason = d3.rollup(
  zoneRows,
  (v) => {
    const share = Object.fromEntries(v.map((d) => [d.zone, d.share]));
    return {
      Rim: share['Rim'],
      'Short paint': share['Short paint'],
      Midrange: share['Midrange'],
      '3-pointers': share['Corner 3'] + share['Above-break 3'],
    };
  },
  (d) => d.season,
);

const courtLabels = [
  { key: 'Rim', x: 0, y: -1.1 },
  { key: 'Midrange', x: -14.5, y: 12 },
  { key: '3-pointers', x: 0, y: 34 },
];

const labelLayer = svg.append('g').attr('class', 'court-labels');
const labelText = labelLayer
  .selectAll('text')
  .data(courtLabels)
  .join('text')
  .attr('x', (d) => x(d.x))
  .attr('y', (d) => y(d.y))
  .attr('text-anchor', 'middle');

function drawCourtLabels(season) {
  const share = shareBySeason.get(season);
  labelText.text((d) => `${d.key} ${d3.format('.0%')(share[d.key])}`);
}

const tooltip = d3.select('#tooltip');

function showTooltip(event, d) {
  tooltip
    .attr('hidden', null)
    .html(
      `<strong>${d.zone}</strong>
      <span>${d.perGame.toFixed(2)} shots per team per game</span>
      <span>${d3.format('.1%')(d.fg)} FG</span>
      <span>${d.pps.toFixed(2)} points per shot</span>`,
    )
    .style('left', `${event.clientX + 14}px`)
    .style('top', `${event.clientY + 14}px`);
}

function seasonLabel(season) {
  return `${season - 1}-${String(season).slice(2)}`;
}

function draw(season) {
  d3.select('#season-label').text(seasonLabel(season));
  drawCourtLabels(season);
  moveMarker(season);

  hexLayer
    .selectAll('path')
    .data(allBins.get(season), (d) => d.key)
    .join(
      (enter) =>
        enter
          .append('path')
          .attr('transform', (d) => `translate(${d.x},${d.y})`)
          .attr('d', hexbin.hexagon(0)),
      (update) => update,
      (exit) => exit.transition().duration(300).attr('d', hexbin.hexagon(0)).remove(),
    )
    .on('mouseenter mousemove', showTooltip)
    .on('mouseleave', () => tooltip.attr('hidden', true))
    .transition()
    .duration(400)
    .attr('fill', hexColor)
    .attr('d', (d) => hexbin.hexagon(size(d.perGame)));
}

const legend = d3.select('#legend');

function drawLegend() {
  legend.selectAll('*').remove();
  const items =
    colorMode === 'zone'
      ? zoneOrder.map((zone) => [zone, zoneColor(zone)])
      : ppsLabels.map((label, i) => [label, ppsColor.range()[i]]);
  if (colorMode === 'pps')
    legend.append('span').attr('class', 'legend-title').text('Points per shot:');
  items.forEach(([label, color]) => {
    const item = legend.append('span').attr('class', 'legend-item');
    item.append('span').attr('class', 'swatch').style('background', color);
    item.append('span').text(label);
  });
}

d3.selectAll('input[name="color-mode"]').on('change', (event) => {
  colorMode = event.target.value;
  drawLegend();
  hexLayer.selectAll('path').transition().duration(400).attr('fill', hexColor);
});

const lineZones = ['Rim', 'Short paint', 'Midrange', '3-pointers'];
const lineColor = d3
  .scaleOrdinal()
  .domain(lineZones)
  .range(['#d55e00', '#e69f00', '#cc79a7', '#0072b2']);

const lw = 760;
const lh = 340;
const lm = { top: 20, right: 120, bottom: 30, left: 44 };

const lx = d3
  .scaleLinear()
  .domain([2004, 2025])
  .range([lm.left, lw - lm.right]);
const ly = d3
  .scaleLinear()
  .domain([0, 0.45])
  .range([lh - lm.bottom, lm.top]);

const lineSvg = d3.select('#lines').append('svg').attr('viewBox', `0 0 ${lw} ${lh}`);

lineSvg
  .append('g')
  .attr('class', 'gridlines')
  .attr('transform', `translate(${lm.left}, 0)`)
  .call(
    d3
      .axisLeft(ly)
      .ticks(5)
      .tickSize(-(lw - lm.left - lm.right))
      .tickFormat(''),
  );

lineSvg
  .append('g')
  .attr('class', 'axis')
  .attr('transform', `translate(0, ${lh - lm.bottom})`)
  .call(
    d3
      .axisBottom(lx)
      .ticks(11)
      .tickFormat((d) => seasonLabel(d)),
  );

lineSvg
  .append('g')
  .attr('class', 'axis')
  .attr('transform', `translate(${lm.left}, 0)`)
  .call(d3.axisLeft(ly).ticks(5).tickFormat(d3.format('.0%')));

const crossover = seasons.find(
  (s) => shareBySeason.get(s)['3-pointers'] > shareBySeason.get(s)['Midrange'],
);

lineSvg
  .append('line')
  .attr('class', 'crossover')
  .attr('x1', lx(crossover))
  .attr('x2', lx(crossover))
  .attr('y1', lm.top)
  .attr('y2', lh - lm.bottom);

lineSvg
  .append('text')
  .attr('class', 'annotation')
  .attr('x', lx(crossover) + 6)
  .attr('y', lm.top + 12)
  .text(`${seasonLabel(crossover)}: threes pass the midrange`);

const lineGen = d3
  .line()
  .x((d) => lx(d.season))
  .y((d) => ly(d.value));

lineZones.forEach((zone) => {
  const points = seasons.map((s) => ({ season: s, value: shareBySeason.get(s)[zone] }));
  lineSvg
    .append('path')
    .attr('class', 'share-line')
    .attr('stroke', lineColor(zone))
    .attr('d', lineGen(points));
  lineSvg
    .append('text')
    .attr('class', 'line-label')
    .attr('x', lx(2025) + 8)
    .attr('y', ly(points.at(-1).value) + 4)
    .attr('fill', lineColor(zone))
    .text(`${zone} ${d3.format('.0%')(points.at(-1).value)}`);
});

const marker = lineSvg.append('g').attr('class', 'marker');
marker
  .append('line')
  .attr('y1', lm.top)
  .attr('y2', lh - lm.bottom);
const markerDots = marker
  .selectAll('circle')
  .data(lineZones)
  .join('circle')
  .attr('r', 4.5)
  .attr('fill', (d) => lineColor(d));

function moveMarker(season) {
  marker.attr('transform', `translate(${lx(season)}, 0)`);
  markerDots.attr('cy', (d) => ly(shareBySeason.get(season)[d]));
}

lineSvg
  .append('rect')
  .attr('class', 'click-area')
  .attr('x', lm.left)
  .attr('y', lm.top)
  .attr('width', lw - lm.left - lm.right)
  .attr('height', lh - lm.top - lm.bottom)
  .on('click', (event) => {
    const [mx] = d3.pointer(event);
    const season = Math.round(lx.invert(mx));
    slider.property('value', season);
    draw(season);
  });

drawLegend();

const slider = d3.select('#season');
slider.on('input', (event) => draw(+event.target.value));

let timer = null;
const playButton = d3.select('#play');
playButton.on('click', () => {
  if (timer) {
    timer.stop();
    timer = null;
    playButton.text('Play');
    return;
  }
  playButton.text('Pause');
  let season = +slider.property('value');
  if (season === 2025) season = 2003;
  timer = d3.interval(() => {
    season += 1;
    slider.property('value', season);
    draw(season);
    if (season === 2025) {
      timer.stop();
      timer = null;
      playButton.text('Play');
    }
  }, 700);
});

draw(2004);