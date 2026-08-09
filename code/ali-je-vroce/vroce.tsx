import { createMemo, onMount, Show } from "solid-js";
import { vrednosti, opisi, opisi_pod_30, percentile_labels } from "./constants.ts";

// Import custom hooks
import { useWeatherData } from "./hooks/useWeatherData.ts";

// Import components
import { StationSelector } from "./components/StationSelector.tsx";
import { TemperatureDisplay } from "./components/TemperatureDisplay.tsx";
import { ErrorMessage } from "./components/ErrorMessage.tsx";
import SeasonalHistogram from "./charts/SeasonalHistogram.tsx";
import SeasonalScatter from "./charts/SeasonalScatter.tsx";

/**
 * AliJeVroce is a Solid JS component that displays whether it is hot today in a selected location,
 * based on temperature statistics fetched from a remote API. It shows the minimum, average, and
 * maximum temperatures over the last 24 hours, their respective times, and compares the average
 * temperature to historical percentiles. The component also provides a textual and visual
 * representation of the result, along with the time of the last data update.
 *
 * @component
 * @returns The rendered component displaying temperature statistics and percentile comparison.
 */
export function AliJeVroce() {
  // ✅ INSERT: test flag + today's label for the SeasonalScatter chart

  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const mmdd = `${mm}-${dd}`;
  const prettyTitleHistogram = `Temperature v dveh tednih okoli ${today.toLocaleString("sl-SI", {
    day: "numeric",
    month: "short",
  })} — porazdelitev`;
  const prettyTitleScatter = `Temperature v dveh tednih okoli ${today.toLocaleString("sl-SI", {
    day: "numeric",
    month: "short",
  })} — zgodovinski trend`;

  // Use the custom hook to manage all data and state
  const {
    // Station data
    stations,
    selectedStation,
    stationPrefix,
    isLoadingStations,
    stationsError,

    // Temperature data
    isLoadingData,
    dataError,
    result,
    resultTemperature,
    tempMin,
    timeMin,
    tempMax,
    timeMax,
    tempAvg,
    timeUpdated,

    // Functions
    initialize,
    retryLoadingData,
    retryLoadingStations,
    onStationChange,
  } = useWeatherData();

  // Initialize the component on mount
  onMount(() => {
    initialize();
  });

  const getDescriptionsForTemperature = createMemo(() => {
    const avg = tempAvg();
    if (avg != null && Number.isFinite(+avg) && +avg < 30) {
      return opisi_pod_30;
    }
    return opisi;
  });

  return (
    <div class="text-center">
      <h1 class="not-prose font-normal md:text-5xl text-4xl font-sans text-balance">
        Ali je danes vroče{" "}
        <StationSelector
          stations={stations()}
          selectedStation={selectedStation()}
          stationPrefix={stationPrefix()}
          isLoading={isLoadingStations()}
          onStationChange={onStationChange}
        />
      </h1>

      <TemperatureDisplay
        result={result()}
        resultTemperature={resultTemperature()}
        tempMin={String(tempMin() ?? "")}
        timeMin={timeMin()}
        tempMax={String(tempMax() ?? "")}
        timeMax={timeMax()}
        tempAvg={String(tempAvg() ?? "")}
        timeUpdated={timeUpdated()}
        isLoading={isLoadingData()}
        isStale={false}
        labels={percentile_labels}
        values={vrednosti}
        selectedStation={selectedStation()}
        descriptions={getDescriptionsForTemperature()}
      />

      <ErrorMessage error={dataError() || ""} onRetry={retryLoadingData} />

      <ErrorMessage
        error={stationsError() || ""}
        onRetry={retryLoadingStations}
      />

      <Show
        when={
          tempAvg() != null &&
          isNaN(+result()) &&
          !isLoadingData() &&
          !!selectedStation()?.station_id
        }
      >
        <div class="mt-10">
          <SeasonalHistogram
            stationId={selectedStation()?.station_id ?? 1495}
            center_mmdd={mmdd}
            todayTemp={(() => {
              const rawTemp = tempAvg();
              return rawTemp != null && Number.isFinite(+rawTemp)
                ? +rawTemp
                : null;
            })()}
            title={prettyTitleHistogram}
          />
          <div class="mt-4 text-left max-w-2xl mx-auto font-sans text-base space-y-3">
            <p>
              Zgornji graf prikazuje razporeditev temperatur, ki je značilna za ta letni čas, ki
              smo ga opredelili kot 15-dnevno obdobje okoli današnjega dne.
              Predstavlja <strong>porazdelitveno krivuljo</strong>, ki je višja pri bolj
              pogostih temperaturah in nižja pri nepogostih ali neznačilnih
              temperaturah.
            </p>
            <p>
              <strong>Ekstremne temperature</strong> definiramo kot
              5 % najbolj vročih ali 5 % najbolj hladnih dni v izbranem obdobju.
              Nahajajo se levo in desno od dveh navpičnih črtkanih črt,
              ki označujeta 5. in 95. percentil. Sredina krivulje (50. percentil)
              označuje temperaturo, ki razdeli porazdelitev na dva enaka dela, tj.
              polovica dni je toplejših od te temperature, druga polovica pa
              hladnejših.
            </p>
            <p>
              Če želimo ugotoviti, ali je bil današnji dan ekstremno hladen ali
              topel, lahko preverimo, ali je današnja povprečna temperatura pod ali
              nad črtkano črto, ki označujeta najhladnejših oziroma najtoplejših 5 %
              dni v tem letnem času.
            </p>
          </div>
        </div>
        <div class="mt-6">
          <SeasonalScatter
            stationId={selectedStation()?.station_id ?? 1495}
            center_mmdd={mmdd}
            todayTemp={(() => {
              const rawTemp = tempAvg();
              return rawTemp != null && Number.isFinite(+rawTemp)
                ? +rawTemp
                : null;
            })()}
            title={prettyTitleScatter}
          />
          <div class="mt-4 text-left max-w-2xl mx-auto font-sans text-base">
            <p>
              Današnji dan v primerjavi z vsemi dnevi iz preteklih let v enakem
              15-dnevnem obdobju, vse do leta 1950. Rdeče označeni dnevi
              so toplejši, modro označeni pa hladnejši od povprečne temperature celotnega zgodovinskega obdobja.
            </p>
            <p>
              Ko skozi podatke potegnemo premico, ki se najbolje prilagaja vsem
              točkam, lahko opazimo, da se je povprečna temperatura v tem
              obdobju skozi desetletja dvignila.
            </p>
          </div>
        </div>
        <div class="mt-6 text-left max-w-2xl mx-auto font-sans text-base italic">
          <p>
            <strong>Opombe:</strong> Okolica vremenske postaje se je s časom lahko spreminjala.
            V mestih trendi v manjši meri odražajo tudi vpliv mestnega toplotnega otoka.
            V prehodnih letnih časih (pomlad in jesen) je prisoten večji časovni temperaturni gradient,
            ki lahko potisne dnevno temperaturo proti ekstremnim vrednostim.
          </p>
        </div>
      </Show>
    </div>
  );
}
