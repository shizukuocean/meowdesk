"use strict";

const { runRendererSmokeRegisteredScenario } = require("./renderer-smoke-scenarios");

async function runRendererSmokeScenario(win, dependencies = {}) {
  const scenario = process.env.MEOWDESK_RENDERER_SMOKE_SCENARIO || "";
  if (!scenario) return null;
  return runRendererSmokeRegisteredScenario(win, dependencies, scenario);
}

function summarizeSmokeImage(image) {
  const size = image.getSize();
  const bitmap = image.toBitmap();
  const colors = new Set();
  let sampledNonDarkPixels = 0;

  for (let y = 0; y < size.height; y += 32) {
    for (let x = 0; x < size.width; x += 32) {
      const index = (y * size.width + x) * 4;
      const c1 = bitmap[index] || 0;
      const c2 = bitmap[index + 1] || 0;
      const c3 = bitmap[index + 2] || 0;
      const alpha = bitmap[index + 3] || 0;
      colors.add(`${c1},${c2},${c3},${alpha}`);
      if (c1 + c2 + c3 > 80) sampledNonDarkPixels += 1;
    }
  }

  return {
    width: size.width,
    height: size.height,
    sampledUniqueColors: colors.size,
    sampledNonDarkPixels
  };
}

function parseRendererSmokeSize() {
  const raw = process.env.MEOWDESK_RENDERER_SMOKE_SIZE || "";
  const match = raw.match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

module.exports = {
  runRendererSmokeScenario,
  summarizeSmokeImage,
  parseRendererSmokeSize
};
