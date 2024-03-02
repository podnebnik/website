---
title: Slogovni vodič
date: git Last Modified
topics: emisije
summary: Pregled slogov za ustvarjanje objav in mehanizmov za vdelavo bogatih vsebin
---

Primer besedila, ki bo objavljen. Besedilo je lahko **odebeljeno** ali *ležeče* ali ***odebeljeno ležeče***. Besedilo lahko tudi ~~prečrtamo~~. Za podpisane in nadpisane številke se priporoča uporaba ustreznih unicode znakov, npr. H₂O, CO₂ in CH₄.

Nov odstavek se začne z vmesno prazno vrstico. Pod tem odstavkom je primer vdelave rastrske slike. Slike se na dovolj širokem zaslonu izrišejo v širini 948 pikslov in se raztegnejo, če so manjše.

POPRAVI: Kako se naredi podnapis k sliki?

<div class="image">{% image "./gore-ales-krivec.jpg", "Exercitation qui dolor" %}</div>

Primer tabele.

| Žival        | Hrana     | Porcija    |
|--------------|-----------|------------|
| Kanarček     | Semena    | 7g         |
| Mačka        | Briketi   | 53g        |

# Naslov

Po moči je ekvivalenten naslovu strani.

## Podnaslov

Običajen podnaslov na strani.

### Pod podnaslov

Pod podnaslov. Zadnji, ki naj se še uporablja.

## Blokcitati (blockquotes)

> Po znaku za matematični simbol "večje od" se lahko vstavi tekst ki bo zgledal kot cicat z vidno vertikalno črto. Citat je lahko dolg več vrstic. Vsaka nova prazna vrstica v tem citatu, mora začeti z istim znakom, za katerim ni več teksta.
>
> Potem pa še naslednja vrstica v istem citatu
>> Če se pa uporabi dvakrat simbol "večje od" potem se pojavi še ena vertikalna črta pred citiranim tekstom, kar zgleda kot vgnezden citat. Za vsako novo prazno vrstico v citatu z dvema vertikalnima črtama, velja isto, da mora začeti z istima znakoma za večje, za katerim ni več teksta.
>>
>> Tukaj je še primer za naslednjo vrstico v vgnezdenem citatu

## Grafi na Podnebniku

Pod tem odstavkom sledi vdelava interaktivnega grafa, ki je izdelan v ogrodju Fable.

<div class="chart" id="chart-from-fable">
    <script type="module">
        import Lazy from '/code/lazy.jsx'
        import { render } from 'solid-js/web'
        import { Chart }  from '/code/examples/fable.highcharts/Chart.fs.jsx'
        render(() => Lazy(() => Chart({kind: 'bar'})), document.getElementById('chart-from-fable'))
    </script>
</div>

POPRAVI: Ne vem kaj je na drugem grafu vsebinsko ali tehnično drugače.

<div class="chart" id="chart-from-js-1">
    <script type="module">
        import Lazy from '/code/lazy.jsx'
        import { render } from 'solid-js/web'
        import Chart from '/code/examples/javascript.highcharts/chart.jsx'
        render(() => Lazy(() => Chart({kind: 'bar'})), document.getElementById('chart-from-js-1'))
    </script>
</div>

Še en graf, ki izgleda zelo podoben gornjemu, samo da se v tem primeru naloži črtni graf.

<div class="chart" id="chart-from-js-2">
    <script type="module">
        import Lazy from '/code/lazy.jsx'
        import { render } from 'solid-js/web'
        import Chart from '/code/examples/javascript.highcharts/chart.jsx'
        render(() => Lazy(() => Chart({kind: 'line'})), document.getElementById('chart-from-js-2'))
    </script>
</div>

## Grafi, ki gostujejo na tretjih straneh

Primer vdelave grafa izdelanega s Flourish.studio, ki uporablja integracijo prek vdelave javascript datoteke in sklica na ID vizualizacije.

<div class="chart">
    <div class="flourish-embed flourish-hierarchy" data-src="visualisation/12923003"><script src="https://public.flourish.studio/resources/embed.js"></script></div>
</div>

## Interaktivni števec

Ta števec ob osvežitvi strani pozabi stanje.

<div id="counter">
    <script type="module">
        import { render } from 'solid-js/web'
        import { Counter }  from '/code/examples/fable.counter/Counter.fs.jsx'
        render(() => Counter(), document.getElementById('counter'))
    </script>
</div>

Ne vem kaj je razlika med zgornjim števcem in spodnjim števcem, ampak v kodi piše elmish.

<div id="elmish-counter">
    <script type="module">
        import Lazy from '/code/lazy.jsx'
        import { render } from 'solid-js/web'
        import { Counter } from '/code/examples/fable.elmish/Counter.fs.jsx'
        render(() => Lazy(() => Counter()), document.getElementById('elmish-counter'))
    </script>
</div>


