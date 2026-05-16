import * as d3 from "d3";
import { geoRobinson, geoWinkel3, geoMollweide } from "d3-geo-projection";

// --- Projection registry ---

const projections = {
  naturalEarth1: () => d3.geoNaturalEarth1(),
  mercator: () => d3.geoMercator(),
  equalEarth: () => d3.geoEqualEarth(),
  orthographic: () => d3.geoOrthographic().clipAngle(90),
  robinson: () => geoRobinson(),
  winkelTripel: () => geoWinkel3(),
  mollweide: () => geoMollweide(),
};

// --- Color generation from name (deterministic) ---

function nameColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = ((hash % 360) + 360) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

// --- Fix GeoJSON winding order for D3 ---
// D3 expects counterclockwise exterior rings (RFC 7946).

// Reverses all rings in a feature (flips winding unconditionally).
function reverseRings(f) {
  const geom = JSON.parse(JSON.stringify(f.geometry));
  if (geom.type === "Polygon") {
    geom.coordinates.forEach((ring) => ring.reverse());
  } else if (geom.type === "MultiPolygon") {
    geom.coordinates.forEach((poly) =>
      poly.forEach((ring) => ring.reverse()),
    );
  }
  return { ...f, geometry: geom };
}

// For CShapes countries: if D3 computes area > half the sphere, winding is wrong.
function fixWindingByArea(features) {
  return features.map((f) => {
    if (d3.geoArea(f) > 2 * Math.PI) return reverseRings(f);
    return f;
  });
}

// For sub-national features (CHGIS prefectures): no single prefecture should
// exceed ~0.5 steradians (~4% of the sphere). Anything larger means D3's
// spherical interpretation flipped the polygon inside-out.
function fixWindingStrict(features) {
  return features.map((f) => {
    if (d3.geoArea(f) > 0.5) return reverseRings(f);
    return f;
  });
}

// --- Date helpers ---

// Create a Date from a year (supports negative/BCE years)
function dateFromYear(year) {
  const d = new Date(0);
  d.setUTCFullYear(year, 0, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Parse CShapes date string "31.12.1885 23:00:00"
function parseCShapesDate(str) {
  const [datePart] = str.split(" ");
  const [day, month, year] = datePart.split(".");
  return new Date(+year, +month - 1, +day);
}

// Format a date for display, handling BCE
function formatDate(date) {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const y = date.getUTCFullYear();
  const m = months[date.getUTCMonth()];
  const d = date.getUTCDate();
  if (y <= 0) {
    return `${d} ${m} ${Math.abs(y - 1)} BCE`;
  }
  return `${d} ${m} ${y}`;
}

// Format just a year, handling BCE
function formatYear(date) {
  const y = date.getUTCFullYear();
  if (y <= 0) return `${Math.abs(y - 1)} BCE`;
  return `${y}`;
}

// --- Dataset definitions ---

const DATASETS = {
  cshapes: {
    url: "/CShapes-2.0.geojson",
    fixWinding: fixWindingByArea,
    // Normalize features after loading
    prepare(features) {
      return features.map((f) => {
        const p = f.properties;
        const start = parseCShapesDate(p.gwsdate);
        const end = parseCShapesDate(p.gwedate);
        return {
          ...f,
          _startTime: start.getTime(),
          _endTime: end.getTime(),
          _key: p.gwcode + "-" + start.getTime(),
          _name: p.cntry_name,
        };
      });
    },
    tooltipHtml(f) {
      const p = f.properties;
      return `
        <div class="tooltip-name">${p.cntry_name}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Capital</span>
          <span>${p.capname}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Period</span>
          <span>${formatDate(new Date(f._startTime))} — ${formatDate(new Date(f._endTime))}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Area</span>
          <span>${d3.format(",")(p.area)} km²</span>
        </div>
      `;
    },
  },

  chgis: {
    url: "/chgis-v6-prefectures.geojson",
    fixWinding: fixWindingStrict,
    prepare(features) {
      return features.map((f) => {
        const p = f.properties;
        const start = dateFromYear(p.BEG_YR);
        const end = dateFromYear(p.END_YR);
        return {
          ...f,
          _startTime: start.getTime(),
          _endTime: end.getTime(),
          _key: p.SYS_ID + "-" + p.BEG_YR,
          _name: p.NAME_PY,
        };
      });
    },
    tooltipHtml(f) {
      const p = f.properties;
      return `
        <div class="tooltip-name">${p.NAME_PY} · ${p.NAME_CH}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Type</span>
          <span>${p.TYPE_PY} (${p.TYPE_CH})</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Period</span>
          <span>${formatDate(new Date(f._startTime))} — ${formatDate(new Date(f._endTime))}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Start reason</span>
          <span>${p.BEG_CHG_TY}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">End reason</span>
          <span>${p.END_CHG_TY}</span>
        </div>
      `;
    },
  },

  cliopatria: {
    url: "/cliopatria.geojson",
    fixWinding: fixWindingByArea,
    prepare(features) {
      return features.map((f) => {
        const p = f.properties;
        const start = dateFromYear(p.FromYear);
        const end = dateFromYear(p.ToYear);
        return {
          ...f,
          _startTime: start.getTime(),
          _endTime: end.getTime(),
          _key: p.Name + "-" + p.FromYear,
          _name: p.Name,
        };
      });
    },
    tooltipHtml(f) {
      const p = f.properties;
      const rows = [`<div class="tooltip-name">${p.Name}</div>`];
      rows.push(`
        <div class="tooltip-row">
          <span class="tooltip-label">Period</span>
          <span>${formatDate(new Date(f._startTime))} — ${formatDate(new Date(f._endTime))}</span>
        </div>`);
      if (p.Area) {
        rows.push(`
        <div class="tooltip-row">
          <span class="tooltip-label">Area</span>
          <span>${d3.format(",")(Math.round(p.Area))} km²</span>
        </div>`);
      }
      if (p.MemberOf) {
        rows.push(`
        <div class="tooltip-row">
          <span class="tooltip-label">Member of</span>
          <span>${p.MemberOf}</span>
        </div>`);
      }
      if (p.Components) {
        rows.push(`
        <div class="tooltip-row">
          <span class="tooltip-label">Components</span>
          <span>${p.Components}</span>
        </div>`);
      }
      return rows.join("");
    },
  },
};

// --- Filter features visible at a given Date ---

function featuresAtDate(features, date) {
  const t = date.getTime();
  return features.filter((f) => t >= f._startTime && t <= f._endTime);
}

// --- Main ---

async function main() {
  const svg = d3.select("#map");
  const container = document.getElementById("map-container");
  const tooltip = d3.select("#tooltip");
  const projSelect = document.getElementById("projection-select");
  const datasetSelect = document.getElementById("dataset-select");

  // State
  let currentProjectionName = projSelect.value;
  let currentDatasetId = datasetSelect.value;
  let currentDate = new Date();
  let allFeatures = [];
  let datasetDef = DATASETS[currentDatasetId];
  let minDate, maxDate;

  // Dataset cache
  const datasetCache = {};

  async function loadDataset(id) {
    if (datasetCache[id]) return datasetCache[id];

    const def = DATASETS[id];
    const data = await d3.json(def.url);
    let features = data.features;
    if (def.fixWinding) features = def.fixWinding(features);
    features = def.prepare(features);
    datasetCache[id] = features;
    return features;
  }

  async function switchDataset(id) {
    currentDatasetId = id;
    datasetDef = DATASETS[id];
    allFeatures = await loadDataset(id);

    minDate = new Date(d3.min(allFeatures, (f) => f._startTime));
    maxDate = new Date(d3.max(allFeatures, (f) => f._endTime));

    // Clamp current date to new range
    if (currentDate < minDate) currentDate = new Date(minDate);
    if (currentDate > maxDate) currentDate = new Date(maxDate);

    buildTimeline();
    renderMap();
  }

  // --- Projection & path ---

  function makeProjection() {
    const { width, height } = container.getBoundingClientRect();
    const proj = projections[currentProjectionName]();
    proj.fitSize([width, height], { type: "Sphere" });
    return proj;
  }

  let projection = makeProjection();
  let path = d3.geoPath(projection);

  // --- Graticule ---

  const graticule = d3.geoGraticule10();

  // --- SVG layers ---

  const gBackground = svg.append("g").attr("class", "background-layer");
  const gGraticule = svg.append("g").attr("class", "graticule-layer");
  const gCountries = svg.append("g").attr("class", "countries-layer");
  const gOutline = svg.append("g").attr("class", "outline-layer");

  gBackground
    .append("path")
    .datum({ type: "Sphere" })
    .attr("class", "land-background");
  gGraticule.append("path").datum(graticule).attr("class", "graticule");
  gOutline.append("path").datum({ type: "Sphere" }).attr("class", "outline");

  // --- Render map ---

  function renderMap() {
    const { width, height } = container.getBoundingClientRect();
    svg.attr("width", width).attr("height", height);

    projection = makeProjection();
    path = d3.geoPath(projection);

    gBackground.select("path").attr("d", path);
    gGraticule.select("path").attr("d", path);
    gOutline.select("path").attr("d", path);

    const visible = featuresAtDate(allFeatures, currentDate);

    const countries = gCountries
      .selectAll(".country")
      .data(visible, (d) => d._key);

    countries.exit().remove();

    const entered = countries
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("fill", (d) => nameColor(d._name))
      .attr("fill-opacity", 0.75)
      .on("mousemove", onMouseMove)
      .on("mouseleave", onMouseLeave)
      .on("click", onClick);

    entered.merge(countries).attr("d", path);
  }

  // --- Tooltip ---

  function onMouseMove(event, d) {
    tooltip.html(datasetDef.tooltipHtml(d));
    tooltip.style("display", "block");

    const tooltipNode = tooltip.node();
    const mapRect = container.getBoundingClientRect();
    let x = event.clientX - mapRect.left + 12;
    let y = event.clientY - mapRect.top + 12;
    if (x + tooltipNode.offsetWidth > mapRect.width) {
      x = event.clientX - mapRect.left - tooltipNode.offsetWidth - 12;
    }
    if (y + tooltipNode.offsetHeight > mapRect.height) {
      y = event.clientY - mapRect.top - tooltipNode.offsetHeight - 12;
    }
    tooltip.style("left", x + "px").style("top", y + "px");
  }

  function onMouseLeave() {
    tooltip.style("display", "none");
  }

  function onClick(event, d) {
    console.log("Clicked:", d._name, d.properties);
  }

  // =====================
  // Timeline (day-level)
  // =====================

  const tlMargin = { left: 48, right: 48, top: 32, bottom: 24 };
  const tlHeight = 80;
  const tlSvg = d3.select("#timeline-svg").attr("height", tlHeight);

  function buildTimeline() {
    const barEl = document.getElementById("timeline-bar");
    const width = barEl.clientWidth;
    const innerW = width - tlMargin.left - tlMargin.right;

    // Time scale for the current dataset's range
    const tlScale = d3
      .scaleTime()
      .domain([minDate, maxDate])
      .range([0, innerW])
      .clamp(true);

    tlSvg.attr("width", width);
    tlSvg.selectAll("*").remove();

    const g = tlSvg
      .append("g")
      .attr("transform", `translate(${tlMargin.left},${tlMargin.top})`);

    const trackY = 0;

    // Track
    g.append("line")
      .attr("class", "timeline-track")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", trackY)
      .attr("y2", trackY);

    // Progress
    const progress = g
      .append("line")
      .attr("class", "timeline-progress")
      .attr("x1", 0)
      .attr("y1", trackY)
      .attr("y2", trackY);

    // Axis — pick tick interval based on date span
    const spanYears =
      maxDate.getUTCFullYear() - minDate.getUTCFullYear();
    let tickInterval;
    if (spanYears > 4000) tickInterval = d3.utcYear.every(500);
    else if (spanYears > 1500) tickInterval = d3.utcYear.every(200);
    else if (spanYears > 500) tickInterval = d3.utcYear.every(100);
    else if (spanYears > 200) tickInterval = d3.utcYear.every(50);
    else if (spanYears > 50) tickInterval = d3.utcYear.every(10);
    else tickInterval = d3.utcYear.every(5);

    const tlAxis = d3
      .axisBottom(tlScale)
      .ticks(tickInterval)
      .tickFormat((d) => formatYear(d))
      .tickSize(6);

    g.append("g")
      .attr("class", "timeline-axis")
      .attr("transform", `translate(0,${trackY + 8})`)
      .call(tlAxis);

    // Date label
    const dateLabel = g
      .append("text")
      .attr("class", "timeline-date-label")
      .attr("y", trackY - 14)
      .text(formatDate(currentDate));

    // Handle
    const handle = g
      .append("circle")
      .attr("class", "timeline-handle")
      .attr("cy", trackY)
      .attr("r", 7);

    // Hit area
    const hitArea = g
      .append("rect")
      .attr("class", "timeline-hit-area")
      .attr("x", 0)
      .attr("y", trackY - 16)
      .attr("width", innerW)
      .attr("height", 32);

    function updateHandle(date) {
      const x = tlScale(date);
      handle.attr("cx", x);
      progress.attr("x2", x);
      dateLabel.attr("x", x).text(formatDate(date));
    }

    function setDateFromX(px) {
      const date = tlScale.invert(Math.max(0, Math.min(innerW, px)));
      date.setUTCHours(0, 0, 0, 0);
      currentDate = date;
      updateHandle(date);
      renderMap();
    }

    hitArea.on("click", function (event) {
      const [mx] = d3.pointer(event, g.node());
      setDateFromX(mx);
    });

    const dragBehavior = d3.drag().on("drag", function (event) {
      const [mx] = d3.pointer(event, g.node());
      setDateFromX(mx);
    });

    handle.call(dragBehavior);
    hitArea.call(dragBehavior);

    updateHandle(currentDate);
  }

  // --- Dataset switching ---

  datasetSelect.addEventListener("change", async () => {
    datasetSelect.disabled = true;
    try {
      await switchDataset(datasetSelect.value);
    } catch (e) {
      console.error("Failed to load dataset:", e);
    } finally {
      datasetSelect.disabled = false;
    }
  });

  // --- Projection switching ---

  projSelect.addEventListener("change", () => {
    currentProjectionName = projSelect.value;
    renderMap();
  });

  // --- Zoom & drag rotation ---

  const zoom = d3
    .zoom()
    .scaleExtent([1, 12])
    .filter((event) => {
      if (currentProjectionName === "orthographic") {
        return event.type === "wheel" || event.type === "dblclick";
      }
      return true;
    })
    .on("zoom", (event) => {
      gBackground.attr("transform", event.transform);
      gGraticule.attr("transform", event.transform);
      gCountries.attr("transform", event.transform);
      gOutline.attr("transform", event.transform);
    });

  svg.call(zoom);

  const drag = d3
    .drag()
    .on("start", function () {
      if (currentProjectionName !== "orthographic") return;
      this.__dragRotation = projection.rotate();
    })
    .on("drag", function (event) {
      if (currentProjectionName !== "orthographic") return;
      const { width } = container.getBoundingClientRect();
      const sensitivity = 360 / width;
      const r = this.__dragRotation;
      const rotation = [
        r[0] + event.dx * sensitivity,
        Math.max(-90, Math.min(90, r[1] - event.dy * sensitivity)),
        r[2],
      ];
      this.__dragRotation = rotation;
      projection.rotate(rotation);
      path = d3.geoPath(projection);

      gBackground.select("path").attr("d", path);
      gGraticule.select("path").attr("d", path);
      gOutline.select("path").attr("d", path);
      gCountries.selectAll(".country").attr("d", path);
    });

  svg.call(drag);

  // --- Resize ---

  window.addEventListener("resize", () => {
    renderMap();
    buildTimeline();
  });

  // --- Initial load ---

  await switchDataset(currentDatasetId);
}

main();
