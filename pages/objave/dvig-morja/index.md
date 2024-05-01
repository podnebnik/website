---
title: Dvig gladine morja v Sloveniji
date: git Last Modified
topics: dvig morja
summary: Za koliko se bo v prihodnjih letih dvignila gladina morja? Kateri deli slovenske obale bodo (bolj pogosto) poplavljeni - in zakaj?
authors:
 - Matjaž Ličer
 - Marko Brumen
 - Zarja Muršič
---

Podnebne spremembe in njihove posledice se odražajo na veliko različnih načinov, ki so medsebojno povezani, zato jih je včasih težko nazorno prikazati. A pravilno prikazani podatki so zgovorni - v tej objavi bomo pokazali, kako se bo zaradi podnebnih sprememb v prihodnosti dvigalo in poplavljalo morje v Sloveniji, zakaj do tega pojava pride in kako na višino poplavljanja vplivajo različni scenariji izpustov toplogrednih plinov. 

S pomočjo različnih strok smo pripravili računske modele in nazorne vizualizacije, za koliko se bo v bližnji prihodnosti - še v tem desetletju! - dvignila gladina morja, katere dele obale bo poplavila in tudi razlago, zakaj bodo ti dogodki pogostejši, kot so bili do sedaj.

Da morje od časa do časa zalije Tartinijev trg v Piranu ali beneške ulice ni nekaj čisto novega, kljub vsemu pa se zdi, da so ti pojavi zadnje čase pogostejši in tudi silovitejši, kot pričajo tudi slike novemberskega poplavljanja piranske obale. 

<figure class="image">
    {% image './assets/okolje_piran.png' %}
    <figcaption>
        Posledice poplavljanja morja v Piranu
        {% photoAuthor 'Ubald Trnkoczy' %}
    </figcaption>
</figure>

Zaradi podnebnih sprememb že prihaja do dviga morske gladine in bolj pogostih poplavljanj obal. Na podlagi številnih meritev gladine morij v zadnjih 100 letih ter s pomočjo satelitskih podatkov so znanstveniki potrdili, da se je gladina oceanov od leta 1880 v povprečju zvišala za 23 centimetrov, do tega več kot 7 cm zgolj v zadnjih 25 letih. 

Slovensko morje pri tem seveda ni izjema. V zadnjih nekaj desetletjih na merilnih postajah v Kopru in Trstu opažamo rast srednje (časovno povprečene) gladine morja, ki znaša preko 4 milimetre na leto (Slika 1). Ne zdi se veliko, a posledice so vseeno lahko presenetljivo velike. 

<figure class="image">
    {% image './assets/graf_visina_morja.png' %}
    <figcaption>
        Srednje letne gladine morja (modre pike) na mareografski postaji v Kopru od leta 1961 dalje. Svetlomodra črta prikazuje desetletno drseče povprečje.
        {% photoAuthor 'ARSO' %}
    </figcaption>
</figure>

Hkrati pa so vse pogostejše tudi t.im. “poplave morja”, ki se pojavijo ob vodostaju 300 cm (merjeno na mareografski postaji v Kopru) oz. pri dvigu gladine za 82 cm nad srednjo vrednost, ki znaša 218 cm.

<figure class="image">
    {% image './assets/graf_vodostoji.png' %}
    <figcaption>
       Število ur z vodostajem nad 300 cm v Kopru
        {% photoAuthor 'ARSO' %}
    </figcaption>
</figure>

### Prikaz dviga morske gladine in poplavljanja morja

Z drsnikom lahko prehajamo med leti in odčitamo, za koliko se bo v prihodnjih letih ob poplavljanju dvignila gladina morja nad današnjo srednjo vrednost 218 cm. 

Nastavimo pa lahko tudi verjetnost, da bo gladina morja ob ekstremih dosegla takšno višino v določenem letu. Oznaka “zelo verjetno” pomeni kar 70% gotovost, da se bo tak dogodek zgodil (vsaj 1x!); “srednje verjetno” pomeni 20% verjetnost, da se tak dogodek zgodi vsaj 1x v letu, malo verjetno pa pomeni 1% možnost, da se extremni dogodek zgodi vsaj 1x v letu. 

Prikaz poplavnih območij v primeru scenarija **SSP2-4.5** po letih 

<div id="seaRise45Flood">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==" crossorigin="">
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js" integrity="sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA==" crossorigin=""></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet-fullscreen@1.0.2/dist/leaflet.fullscreen.css" integrity="sha512-Tbna5DrK+N26ZZczWjdHj7BHyU3vUAjA7JsGhIyTM/7jBiy4f4DbiScuLQxaxB51+Gh/+a+Z7AwQmh2FyafjLg==" crossorigin="">
    <script src="https://unpkg.com/leaflet-fullscreen@1.0.2/dist/Leaflet.fullscreen.min.js" integrity="sha512-N/rydaIg6KU3Pvy8M0RZTQoMBsgA3+oKZ5dWY3lvGoT7DeOyLI0rhNb12OGmu8zRixAOXJvs8QQ02zcbkjwx8g==" crossorigin=""></script>
    <script type="module">
        import SeaRise from '/code/dvig-morja/index.jsx'
        SeaRise(document.getElementById('seaRise45Flood'), "RCP45", true)
    </script>
    <div class="chart map" style="height: 40rem;"></div>
    <div>
        <input class="yearSelectionSlider w-full" type="range" min="2023" max="2100" value="2050">
        <div class="grid grid-cols-3 gap-4 place-items-center">
            <div>
                <input type="radio" id="probability070" name="probability" value="0.7">
                <label for="probability070">Zelo verjetno</label>
            </div>
            <div>
                <input type="radio" id="probability020" name="probability" checked="checked" value="0.2">
                <label for="probability020">Srednje verjetno</label>
            </div>
            <div>
                <input type="radio" id="probability001" name="probability" value="0.01">
                <label for="probability001">Malo verjetno</label>
            </div>
        </div>
    </div>
</div>


Scenarij **SSP5-8**

<div id="seaRise85Flood">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==" crossorigin="">
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js" integrity="sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA==" crossorigin=""></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet-fullscreen@1.0.2/dist/leaflet.fullscreen.css" integrity="sha512-Tbna5DrK+N26ZZczWjdHj7BHyU3vUAjA7JsGhIyTM/7jBiy4f4DbiScuLQxaxB51+Gh/+a+Z7AwQmh2FyafjLg==" crossorigin="">
    <script src="https://unpkg.com/leaflet-fullscreen@1.0.2/dist/Leaflet.fullscreen.min.js" integrity="sha512-N/rydaIg6KU3Pvy8M0RZTQoMBsgA3+oKZ5dWY3lvGoT7DeOyLI0rhNb12OGmu8zRixAOXJvs8QQ02zcbkjwx8g==" crossorigin=""></script>
    <script type="module">
        import SeaRise from '/code/dvig-morja/index.jsx'
        SeaRise(document.getElementById('seaRise85Flood'), "RCP85", true)
    </script>
    <div class="chart map" style="height: 40rem;"></div>
    <div>
        <input class="yearSelectionSlider w-full" type="range" min="2023" max="2100" value="2050">
        <div class="grid grid-cols-3 gap-4 place-items-center">
            <div>
                <input type="radio" id="probability070" name="probability_85" value="0.7">
                <label for="probability070">Zelo verjetno</label>
            </div>
            <div>
                <input type="radio" id="probability020" name="probability_85" checked="checked" value="0.2">
                <label for="probability020">Srednje verjetno</label>
            </div>
            <div>
                <input type="radio" id="probability001" name="probability_85" value="0.01">
                <label for="probability001">Malo verjetno</label>
            </div>
        </div>
    </div>
</div>


Slovenska obala je večinoma visoka, zato bo poplavam izpostavljen le manjši del obalnega pasu, ampak prav ta, ki je v največji meri namenjen kulturni rabi (poselitev, turizem, promet, kmetijstvo). Obsežnejša poplavna območja bodo ob višjih plimah nastala na izlivih rek, kjer je nizka, akumulacijska obala. Če bodo izdatne padavine sovpadle z visokimi plimami, kar se pogosto zgodi v jeseni, bodo obale in spodnje dele dolin v slovenski Istri prizadele tudi obsežne poplave [^1] (Kovačič, Kolega in Brečko Grubar, 2016).

Za lažjo predstavo: poplavljene površine ob poplavljene površine ob dvigu srednje višine morja za 100 cm in ob višji plimi, ki bi obsegale 1246 ha. Poplavljeno je primerljivo z današnjim območjem izjemnih poplav, ogrožena bodo pozidana območja nizke obale, prevladujoče visoke (klifne) obale pa bodo veliko bolj izpostavljene erozijskemu delovanju morja. Tako kot današnje poplave morja bi tudi dvig gladine največ težav povzročal v Piranu, kjer je strnjeno pozidana nizka obala neposredno ob morju. 

Poplavljen bi bil velik del starega mestnega jedra. Na območju Bernardina in Portoroža bi bile poplavljene predvsem plaže, v Luciji tudi nekatera stanovanjska območja. Sečoveljske soline in njihova bližja okolica pa bi bile poplavljene v celoti. Število poplavljenih stavb (hišnih naslovov) na območju slovenske Istre bi bilo 848, skupno število ogroženega prebivalstva pa približno 3800, od katerih jih največ živi v Kopru [^2].

### Kako je vizualizacija narejena?

Grafične prikazei različnih stopenj poplavljenosti slovenske obale smo pripravili s pomočjo LIDAR posnetkov reliefa slovenske obale v kombinaciji z različnimi modelskimi predvidevanji raziskovalk in raziskovalcev Medvladnega foruma za podnebne spremembe ([IPCC - Intergovernmental Panel on Climate Change](https://sl.wikipedia.org/wiki/Medvladni_forum_za_podnebne_spremembe)), ki deluje kot znanstveno telo Združenih narodov na podlagi znanstvenega konsenza. 

Raziskovalke in raziskovalci, ki sodelujejo pri pripravi poročil IPCC  v vsakem poročilu pripravijo različne možne scenarije za prihodnje podnebje, ki temeljijo na različnih možnih kombinacijah emisij toplogrednih plinov v ozračju. 

Scenariji izpustov so označeni s kraticami SSPx-y, kjer “SSPx” pomeni verzijo poti skupnega družbeno-ekonomskega razvoja (ang. Shared Socioeconomic Pathways, SSP) oz. družbeno-gospodarskih trendiov v podanem scenariju, “y” pa se nanaša na približno neto sevalno bilanco (dvig temperature) danega scenarija ob koncu stoletja.

Za našo vizualizacijo smo uporabili dva scenarija, ki se imenujeta  **SSP2-4.5** in **SSP5-8**:

**SSP2-4.5** (imenovan Srednja pot, ang. Middle of the Road) predvideva scenarij s srednje velikimi izpusti CO2 in drugih plinov na sedanji ravni do sredine stoletja, nato pa predvideva njihov padec. Po tem scenariju na svetovni ravni družbeni, gospodarski in tehnološki trendi ne bi preveč odstopali od dosedanjih zgodovinskih, globalne in nacionalne organizacije pa bi le počasi dosegale cilje trajnostnega razvoja, razvoj in povečanje dohodka pa bi napredovala neenakomerno. Globalna temperatura se bi povišala za 4,5°C. 

**SSP5-8** (imenovan “Vožnja po avtocesti” oz. “Taking the highway”) predvideva zelo velike izpusti toplogrednih plinov, ki do leta 2050 podvojijo emisije zaradi nadaljnje neomejene uporabe fosilnih goriv. Pot k trajnostnemu razvoju bi prepustili tekmovanju na trgu, inovacijam in sodelovanju med družbami. Vlaganja v zdravstvo in izobraževanje bi bila visoka, še vedno bi izkoriščali tudi fosilna goriva, energijsko in materialno potraten življenjski slog bi se razširil po vsem svetu. Svetovno gospodarstvo bi (ekonomsko gledano) pospešeno raslo.

Trenutni načini delovanja oz. omejevanja izpustov topogrednih plinov in porabe nas trenutno vodijo blizu scenarija SSP2-4.5 

Pri vizualizaciji **nismo** vključili součinkovanje lokalnih dejavnikov, kot so plomovanje in ostali meteorološki vplivi, ki bodo občasno še dodatno prispevali k pogostnosti poplavljanja morja.

### Zakaj se gladina morja dviguje? 

Osnovni dejavniki dvigovanja morij so povišani izpusti toplogrednih plinov, ki povzročajo segrevanje planeta, to pa ima za posledico pospešeno taljenje kopenskega ledu na Grenlandiji, Antarktiki in na ostalih kopenskih ledenikih, hkrati pa povzroča termično razpenjanje oceanov. 

Prvi dejavnik, povezan s taljenjem lednih mas na Zemlji, pomeni vnos dodatnih vodnih mas v svetovna morja. Količina vode v svetovnih morjih torej raste, s tem pa tudi srednja gladina  (povprečje zadnjih 18 let) morja. Drugi dejavnik, ki prispeva k dvigu morske gladine je termično raztezanje vode in je enak mehanizmu raztezanja kapljevine, kot ga lahko opazujemo v navadnem kapljevinskem termometru za merjenje telesne temperature. Ko se kapljevina v bučki termometra zaradi segrevanje volumsko razpne (razširi), potisne gladino tekočine v tanki kapilari naprej. Čeprav gre za relativno majhne spremembe, je to pri skupni količini morske vode na planetu - 1,386,000,000 kubičnih kilometrov - kljub vsemu ogromna številka. Za primerjavo: v Bohinjskem in Blejskem jezeru skupaj je 118.300.000 m3 (0,1183 km3) vode, kar v grobem ustreza letni porabi gospodinjstev in podjetij v Sloveniji. 

<figure class="image">
    {% image './assets/ilustracija_zakaj.png' %}
    <figcaption>
       Prikaz vpliva taljenja ledu in raztezanja vode
        {% photoAuthor 'Dora Rupčič, Alenka Guček' %}
    </figcaption>
</figure>


A opisani vzrok za dvig srednje gladine morja zaradi podnebnih sprememb je zgolj eden od temeljnih dejavnikov, na podlagi katerega se lokalne poplave v severnem Jadranu in drugod po svetu odvijajo vedno pogosteje. 

Drugi bistveni dejavniki so sovpadanje plimovanja ter meteoroloških vplivov (npr. narivanje vetra, zračni pritisk), ki so specifični za naše kraje in jih natančneje pojasnjujemo v naslednjem poglavju. 


## Kdaj in zakaj se zgodijo poplave v Severnem Jadranu? 

Do poplav v severnem Jadranu pride zaradi sodelovanja dveh dodatnih dejavnikov: vremena in plimovanja. Pogosto ljudje pogovorno s plimovanjem označujemo katerokoli dviganje in upadanje morske gladine, vendar to ni povsem pravilno. Zato si ločeno nekoliko natančneje oglejmo, kakšen vpliv na morsko gladino ima plimovanje in kakšen vpliv ima vreme.


### Plimovanje in vremenski vpliv

Poplave se v našem morju zgodijo, ko pride do sovpadanja večih vplivov - najpomembnejša sta plimovanje in vreme. S plimovanjem razumemo izključno spremembe gladine morja zaradi vplivov Sonca in Lune, ki zaradi svoje težnosti v globokih oceanih povzročata dolge plimne valove, ki se nato širijo po svetovnih oceanih.  Ti valovi v eni uri prepotujejo tudi več sto do tisoč kilometrov in so dolgi na stotine, celo tisoče kilometrov.  V Sredozemlje plimni valovi vstopajo skozi Gibraltarsko ožino ter se nato širijo proti vzhodu in v Jadranski bazen. Kadar v severni Jadran pripotuje vrh takega plimnega vala, pravimo, da je v severnem Jadranu plima. Ko pa, nasprotno, k nam pripotuje dolina takega vala, temu rečemo oseka. Plima in oseka si neprestano, neodvisno od meteoroloških vplivov, sledita po svetovnih morjih. 

Z meteorološkim vplivom, ki je povsem neodvisen od plimovanja, pa opisujemo predvsem spremembe gladine, povezane z zračnim pritiskom in vetrom nad morjem. Dvig gladine morja ob jugu je v Jadranu povezan s padcem zračnega pritiska ob prehodu ciklona in povezanimi vetrovi, zlasti z jugom. Jugo v Jadranskem bazenu tipično poganja morske tokove proti zaprtemu severnemu delu Jadranskega bazena. Jugo tako povzroči naklon gladine proti severu, ne zmore pa tega naklona trajno vzdrževati. Gladina morja zato v Jadranu po kakem dnevu juga “pljuskne” nazaj proti jugu, in v Jadranskem bazenu se pojavi stoječe valovanje, podobno pljuskanju, ki nastane, ko z roko zmotimo vodo v kopalni kadi. Tipična perioda takega stoječega valovanja je 22 ur, valovanje pa je dokaj šibko dušeno in tako lahko vztraja v Jadranu še dneve po tem, ko je jugo že ugasnil. Poplave v severnem Jadranu se pojavijo, ko vrh meteorološko povzročenega stoječega valovanja v dovoljšnji meri sovpade z vrhom gravitacijsko generirane plime. Največji odmik tega nihanja je najmočnejši v plitkem severnem Jadranu, denimo v Kopru, Trstu in Benetkah, manj izrazit pa je v globljem južnem delu Jadranskega bazena, denimo v Splitu ali Dubrovniku.

<figure class="image">
    {% image './assets/oblike_terena.png' %}
    <figcaption>
       Prikaz oblike terena in globine Jadranskega bazena. Z rdečo puščico je označena smer juga
        {% photoAuthor 'Matjaž Ličer' %}
    </figcaption>
</figure>

### Povezave in viri (za referenco)


[https://www.carbonbrief.org/explainer-how-climate-change-is-accelerating-sea-level-rise/](https://www.carbonbrief.org/explainer-how-climate-change-is-accelerating-sea-level-rise/)
[https://sealevel.nasa.gov/ipcc-ar6-sea-level-projection-tool?type=global](https://sealevel.nasa.gov/ipcc-ar6-sea-level-projection-tool?type=global) 
[https://sealevel.nasa.gov/ipcc-ar6-sea-level-projection-tool?type=global](https://sealevel.nasa.gov/ipcc-ar6-sea-level-projection-tool?type=global)
[https://sealevel.nasa.gov/ipcc-ar6-sea-level-projection-tool?type=global](https://sealevel.nasa.gov/ipcc-ar6-sea-level-projection-tool?type=global)
[https://www.carbonbrief.org/explainer-how-shared-socioeconomic-pathways-explore-future-climate-change/](https://www.carbonbrief.org/explainer-how-shared-socioeconomic-pathways-explore-future-climate-change/)
[https://www.carbonbrief.org/explainer-how-shared-socioeconomic-pathways-explore-future-climate-change/](https://www.carbonbrief.org/explainer-how-shared-socioeconomic-pathways-explore-future-climate-change/)
[https://zenodo.org/record/6382554](https://zenodo.org/record/6382554)
[https://www.nib.si/mbp/sl/home/news/902-podnebne-spremembe-in-narascanje-gladine-morja-v-severnem-jadranu](https://www.nib.si/mbp/sl/home/news/902-podnebne-spremembe-in-narascanje-gladine-morja-v-severnem-jadranu)

### Viri:
[The Climate Dictionary: An everyday guide to climate change](https://climatepromise.undp.org/news-and-stories/climate-dictionary-everyday-guide-climate-change)
[Climate Journalism That Works](https://www.ebu.ch/files/live/sites/ebu/files/Publications/strategic/open/News_report_2023_Climate_Journalism.pdf)
[IPCC Special Report Glossary (IPCCC) ](https://www.ipcc.ch/sr15/chapter/glossary/)
[UNFCC Process Climate Acronyms and Terms (UNFCC) ](https://unfccc.int/process-and-meetings/the-convention/glossary-of-climate-change-acronyms-and-terms)
[UN Climate Negotiations Glossary (Carbon Brief) ](https://www.carbonbrief.org/an-international-climate-change-negotiations-glossary/)
[Climate Change Glossary (UK Met Office) ](https://www.metoffice.gov.uk/weather/climate-change/climate-glossary)
[European Environment Agency Glossary (EU)](https://www.eea.europa.eu/help/glossary#c4=10&c0=all&b_start=0) 
[Climate Glossary for Young People (UNICEF)](https://www.unicef.org/lac/media/19321/file/climate-glossary-for-young-people.pdf)
[Prepletanje umetne inteligence in fizike pri napovedovanju obalnih poplav](https://www.alternator.science/sl/daljse/prepletanje-umetne-inteligence-in-fizike-pri-napovedovanju-obalnih-poplav/)

### Povezave za “drugi zanimivi članki” 
[https://sway.office.com/9mUAAIDjrVUEIoss](https://sway.office.com/9mUAAIDjrVUEIoss)
[https://www.nps.gov/articles/images/how-seiche-occurs-noaa.jpeg?maxwidth=1300&autorotate=false](https://www.nps.gov/articles/images/how-seiche-occurs-noaa.jpeg?maxwidth=1300&autorotate=false) 
[Uporabljena je splošna porazdelitev ekstremnih vrednosti (GEV).](https://www.unicef.org/lac/media/19321/file/climate-glossary-for-young-people.pdf)
[https://www.zrss.si/arhiv_clankov/podnebne-spremembe-vplivajo-na-pogostejse-poplave-morja/](https://www.zrss.si/arhiv_clankov/podnebne-spremembe-vplivajo-na-pogostejse-poplave-morja/)


## Notes

[^1]: Kovačič, Gregor, Kolega, Nataša, Brečko Grubar, Valentina, Kovačič, Primož (2016). Vpliv podnebnih sprememb na količine vode in poplave morja v slovenski Istri. Geografski vestnik, letnik 88, številka 1, str. 21-36. [URN:NBN:SI:DOC-V22YIFK6](http://www.dlib.si)

[^2]: [Kovačič, Gregor, Kolega, Nataša, Brečko Grubar, Valentina, Kovačič, Primož (2019)](https://doi.org/10.59132/geo/2019/3/30-34). Podnebne spremembe vplivajo na pogostejše poplave morja. 
