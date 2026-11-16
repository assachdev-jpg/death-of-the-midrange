import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const width = 500;
const height = 470;

const x = d3.scaleLinear().domain([-25, 25]).range([0, width]);
const y = d3.scaleLinear().domain([0, 47]).range([0, height]);

const hoop = { x: 0, y: 5.25 };
const threeRadius = 23.75;
const cornerX = 22;

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
  .attr('viewBox', `0 0 ${width} ${height}`);

const court = svg.append('g').attr('class', 'court-lines');

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

court
  .append('line')
  .attr('class', 'backboard')
  .attr('x1', x(-3))
  .attr('x2', x(3))
  .attr('y1', y(4))
  .attr('y2', y(4));

court
  .append('circle')
  .attr('class', 'rim')
  .attr('cx', x(hoop.x))
  .attr('cy', y(hoop.y))
  .attr('r', x(0.75) - x(0));