/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialReadModelState,
  createOptimisticDisplayFields,
  dateForCurrentHotnessPercentiles,
  readSelectedStationPreference,
  stationPreferenceStorageKey,
  toDisplayFields,
  toProcessedCurrentHotness,
  toProcessedStation,
  toProcessedStations,
  toStationPreference,
  writeSelectedStationPreference,
  type PreferenceStorage,
} from "./readModel.ts";
import { DEFAULT_STATION } from "../constants.ts";
import type { ProcessedTemperatureData } from "../../types/models.ts";
import type { RequestStationData } from "../../types/api-raw.ts";

function createMemoryStorage(entries: Record<string, string> = {}): PreferenceStorage {
  return {
    getItem(key) {
      return entries[key] ?? null;
    },
    setItem(key, value) {
      entries[key] = value;
    },
    removeItem(key) {
      delete entries[key];
    },
  };
}

function createThrowingStorage(): PreferenceStorage {
  return {
    getItem() {
      throw new Error("storage unavailable");
    },
    setItem() {
      throw new Error("storage unavailable");
    },
    removeItem() {
      throw new Error("storage unavailable");
    },
  };
}

function withSuppressedWarnings(run: () => void): void {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    run();
  } finally {
    console.warn = originalWarn;
  }
}

test("selected station preference migrates legacy storage keys", () => {
  const storage = createMemoryStorage({
    selectedStation: JSON.stringify({ value: 1491, label: "Maribor", prefix: "v" }),
  });

  const preference = readSelectedStationPreference(storage, DEFAULT_STATION);

  assert.deepEqual(preference, { value: 1491, label: "Maribor", prefix: "v" });
  assert.equal(storage.getItem("selectedStation"), null);
  assert.equal(
    storage.getItem(stationPreferenceStorageKey),
    JSON.stringify({ value: 1491, label: "Maribor", prefix: "v" }),
  );
});

test("selected station preference falls back when storage is unavailable", () => {
  const storage = createThrowingStorage();

  withSuppressedWarnings(() => {
    assert.deepEqual(readSelectedStationPreference(storage, DEFAULT_STATION), DEFAULT_STATION);
    assert.doesNotThrow(() => {
      createInitialReadModelState(storage);
    });
  });
});

test("writing selected station preference is a no-op when storage is unavailable", () => {
  const storage = createThrowingStorage();

  withSuppressedWarnings(() => {
    assert.doesNotThrow(() => {
      writeSelectedStationPreference(storage, {
        value: 1495,
        label: "Ljubljani",
        prefix: "v",
      });
    });
  });
});

test("malformed selected station preferences reset to default", () => {
  const storage = createMemoryStorage({
    [stationPreferenceStorageKey]: JSON.stringify({
      value: 1495,
      label: "Ljubljani",
      prefix: "",
    }),
  });

  assert.deepEqual(readSelectedStationPreference(storage, DEFAULT_STATION), DEFAULT_STATION);
});

test("read model creates initial state from persisted selected station", () => {
  const storage = createMemoryStorage({
    [stationPreferenceStorageKey]: JSON.stringify({
      value: 1025,
      label: "Celju",
      prefix: "v",
    }),
  });

  assert.deepEqual(createInitialReadModelState(storage), {
    selectedStation: { value: 1025, label: "Celju", prefix: "v" },
    stationPrefix: "v",
    result: "",
    resultTemperature: "C",
    timeMin: "",
    timeMax: "",
    timeUpdated: "",
  });
});

test("station conversion keeps preference and processed station shapes local", () => {
  const processed = { station_id: 1447, name_locative: "Novem mestu", prefix: "v" };
  const preference = toStationPreference(processed);

  assert.deepEqual(preference, { value: 1447, label: "Novem mestu", prefix: "v" });
  assert.deepEqual(toProcessedStation(preference), processed);
});

test("temperature data maps to current display fields", () => {
  const data: ProcessedTemperatureData = {
    resultValue: "p80",
    resultTemperatureValue: 28.4,
    tempMin: 20.1,
    timeMin: "danes ob 05:00",
    tempMax: 31.2,
    timeMax: "danes ob 15:00",
    tempAvg: 26.7,
    timeUpdated: "21. junij 2026 ob 12:00",
  };

  assert.deepEqual(toDisplayFields(data), {
    result: "p80",
    resultTemperature: "28.4 °C",
    tempMin: 20.1,
    timeMin: "danes ob 05:00",
    tempMax: 31.2,
    timeMax: "danes ob 15:00",
    tempAvg: 26.7,
    timeUpdated: "21. junij 2026 ob 12:00",
  });
});

test("optimistic display prefers cached station data and marks it refreshing", () => {
  const cached: ProcessedTemperatureData = {
    resultValue: "p60",
    resultTemperatureValue: 24,
    tempMin: 18,
    timeMin: "danes ob 06:00",
    tempMax: 29,
    timeMax: "danes ob 14:00",
    tempAvg: 23,
    timeUpdated: "21. junij 2026 ob 11:00",
  };

  assert.deepEqual(createOptimisticDisplayFields(cached, null), {
    result: "p60",
    resultTemperature: "24 °C",
    tempMin: 18,
    timeMin: "danes ob 06:00",
    tempMax: 29,
    timeMax: "danes ob 14:00",
    tempAvg: 23,
    timeUpdated: "21. junij 2026 ob 11:00 (osvežujem...)",
  });
});

test("optimistic display falls back to a loading placeholder when only previous data exists", () => {
  const previous = {} as ProcessedTemperatureData;

  assert.deepEqual(createOptimisticDisplayFields(null, previous), {
    result: "p40",
    resultTemperature: "...",
    tempMin: "...",
    timeMin: "...",
    tempMax: "...",
    timeMax: "...",
    tempAvg: "...",
    timeUpdated: "Nalagam sveže podatke...",
  });
  assert.equal(createOptimisticDisplayFields(null, null), null);
});

test("station rows become processed stations with locative prefix separated", () => {
  assert.deepEqual(
    toProcessedStations({
      rows: [
        [0, 1495, "Ljubljana", "v Ljubljani"],
        [1, 1447, "Novo mesto", "v Novem mestu"],
      ],
    }),
    [
      { station_id: 1495, name_locative: "Ljubljani", prefix: "v" },
      { station_id: 1447, name_locative: "Novem mestu", prefix: "v" },
    ],
  );
});

test("current hotness transform chooses the matching percentile bucket", () => {
  const updatedAt = new Date(2026, 5, 21, 16, 0);
  const minAt = new Date(2026, 5, 21, 6, 30);
  const maxAt = new Date(2026, 5, 21, 15, 45);
  const stationData = {
    statistics: {
      timestamp: String(updatedAt.getTime()),
      temperature_average_24h: 27,
      temperature_average_48h: 26,
      temperature_min_24h: 18,
      temperature_max_24h: 31,
      timestamp_temperature_min_24h: String(minAt.getTime()),
      timestamp_temperature_max_24h: String(maxAt.getTime()),
    },
  } as RequestStationData;

  assert.equal(dateForCurrentHotnessPercentiles(stationData), "2026-06-21");
  assert.deepEqual(
    toProcessedCurrentHotness(stationData, {
      columns: ["rowid", "p05", "p20", "p40", "p60", "p80", "p95"],
      rows: [[1, 10, 15, 20, 25, 30, 35]],
    }),
    {
      resultValue: "p60",
      resultTemperatureValue: 25,
      tempMin: 18,
      timeMin: "danes ob 06:30",
      tempMax: 31,
      timeMax: "danes ob 15:45",
      tempAvg: 27,
      timeUpdated: new Intl.DateTimeFormat("sl-SI", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(updatedAt),
    },
  );
});
