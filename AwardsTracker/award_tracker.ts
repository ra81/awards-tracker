
/// <reference path= "../../_jsHelper/jsHelper/jsHelper.ts" />

$ = jQuery = jQuery.noConflict(true);
$xioDebug = true;
let Realm = getRealmOrError();
let CompanyId = getCompanyId();
let CurrentGameDate = parseGameDate(document, document.location.pathname);
let DataVersion = 1;    // версия сохраняемых данных. При изменении формата менять и версию
let StorageKeyCode = "prt";

// новый расширенный
interface IAwardsInfo {
    date: Date;
    today: string[];        // сегодняшние награды
    yesterday: string[];    // вчерашние награды, ну или некие последние которые мы записали
}


// упрощаем себе жисть, подставляем имя скрипта всегда в сообщении
function log(msg: string, ...args: any[]) {
    msg = "prises: " + msg;
    logDebug(msg, ...args);
}


async function Start_async() {
    if (!isMyUnitList())
        return;

    // читаем хранилище на наличие вчерашних наград
    let awards = loadInfo();
    if (awards == null) {
        // еще не было записей, запишем базовое
        let imgs = await parseAwards_async();
        awards = { date: CurrentGameDate, today: imgs, yesterday: [] };
        saveInfo(awards);
    }
    else if (awards.date < CurrentGameDate) {
        // запись есть но старая
        let tmp = awards.today;
        let imgs = await parseAwards_async();
        awards.today = imgs;
        awards.yesterday = tmp;
        saveInfo(awards);
    }
    
    // теперь рисуем собсна новые и пропавшие награды
    let $container = $("#unitImage");
    let $awards = $(`<div id='awards'>
                        <div id='newAwards'><span>NEW: </span></div>
                        <div id='missedAwards'><span>MIS: </span></div>
                    </div>`);

    let $new = $awards.find("#newAwards");
    for (let img of awards.today) {
        if (awards.yesterday.indexOf(img) < 0)
            $new.append(`<img src="${img}">`);
    }

    let $missed = $awards.find("#missedAwards");
    for (let img of awards.yesterday) {
        if (awards.today.indexOf(img) < 0)
            $missed.append(`<img src="${img}">`);
    }

    $container.children().remove();
    $container.append($awards);

    log("закончили");
}


function saveInfo(info: IAwardsInfo) {
    let storeKey = buildStoreKey(Realm, StorageKeyCode, CompanyId);
    localStorage[storeKey] = JSON.stringify([DataVersion, info]);
}

function loadInfo(): IAwardsInfo | null {

    let storeKey = buildStoreKey(Realm, StorageKeyCode, CompanyId);
    let str = localStorage[storeKey];
    if (str == null)
        return null;

    let [ver, info] = JSON.parse(str) as [number, IAwardsInfo];
    return info;
}

/**
 * собираем награды со странички
 */
async function parseAwards_async(): Promise<string[]>  {

    try {
        let url = `/${Realm}/main/company/rank/${CompanyId}`;
        let html = await tryGet_async(url);

        let imgs = $(html).find("div.d-award img").map((i, el) => $(el).attr("src")).get() as any as string[];
        return imgs;
    }
    catch (err) {
        alert((err as Error).message);
        throw err;
    }
}

/**
 * Со странички пробуем спарсить игровую дату. А так как дата есть почти везде, то можно почти везде ее спарсить
 * Вывалит ошибку если не сможет спарсить дату со странички
 * @param html
 * @param url
 */
function parseGameDate(html: any, url: string): Date {
    let $html = $(html);

    try {
        // вытащим текущую дату, потому как сохранять данные будем используя ее
        let $date = $html.find("div.date_time");
        if ($date.length !== 1)
            throw new Error("Не получилось получить текущую игровую дату");

        let currentGameDate = extractDate(getOnlyText($date)[0].trim());
        if (currentGameDate == null)
            throw new Error("Не получилось получить текущую игровую дату");

        return currentGameDate;
    }
    catch (err) {
        throw err;
    }
}


$(document).ready(() => Start_async());