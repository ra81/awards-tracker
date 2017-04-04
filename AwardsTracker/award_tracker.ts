
//// /// <reference path= "../../_jsHelper/jsHelper/jsHelper.ts" />

$ = jQuery = jQuery.noConflict(true);
let Realm = getRealmOrError();
let CompanyId = getCompanyId();
let CurrentGameDate = parseGameDate(document, document.location.pathname);
let DataVersion = 1;    // версия сохраняемых данных. При изменении формата менять и версию
let StorageKeyCode = "prt";

// новый расширенный
interface IAwardsInfo {
    date: string;
    today: string[];        // сегодняшние награды
    yesterday: string[];    // вчерашние награды, ну или некие последние которые мы записали
}

async function Start_async() {
    if (!isMyUnitList())
        return;

    // читаем хранилище на наличие вчерашних наград
    let awards = loadInfo();
    if (awards == null) {
        // еще не было записей, запишем базовое
        let imgs = await parseAwards_async();
        awards = { date: dateToShort(CurrentGameDate), today: imgs, yesterday: [] };
        saveInfo(awards);
    }
    else if (dateFromShort(awards.date) < CurrentGameDate) {
        // запись есть но старая
        //let tmp = awards.today;
        let imgs = await parseAwards_async();
        awards = { date: dateToShort(CurrentGameDate), today: imgs, yesterday: awards.today };
        //    //.today = imgs;
        //awards.yesterday = tmp;
        //awards.date = dateToShort(CurrentGameDate);
        saveInfo(awards);
    }
    
    // теперь рисуем собсна новые и пропавшие награды
    let $container = $("#unitImage");
    let $awards = $(`<div id='awards'>
                        <div id='newAwards'><span>NEW: </span></div>
                        <div id='missedAwards'><span>MIS: </span></div>
                    </div>`);

    let $new = $awards.find("#newAwards");
    for (let img of awards.today.sort()) {
        if (awards.yesterday.indexOf(img) < 0)
            $new.append(`<img src="${img}">`);
    }

    let $missed = $awards.find("#missedAwards");
    for (let img of awards.yesterday.sort()) {
        if (awards.today.indexOf(img) < 0)
            $missed.append(`<img src="${img}">`);
    }

    $container.children().remove();
    $container.append($awards);
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

/**
 * По типовой игровой строке даты вида 10 января 55 г., 3 февраля 2017 - 22.10.12
 * выдергивает именно дату и возвращает в виде объекта даты
 * @param str
 */
function extractDate(str: string): Date | null {
    let dateRx = /^(\d{1,2})\s+([а-я]+)\s+(\d{1,4})/i;
    let m = dateRx.exec(str);
    if (m == null)
        return null;

    let d = parseInt(m[1]);
    let mon = monthFromStr(m[2]);
    if (mon == null)
        return null;

    let y = parseInt(m[3]);

    return new Date(y, mon, d);
}

/**
 * Для заданного элемента, находит все непосредственно расположенные в нем текстовые ноды и возвращает их текст.
   очень удобен для извлечения непосредственного текста из тэга БЕЗ текста дочерних нодов
 * @param item 1 объект типа JQuery
 */
function getOnlyText(item: JQuery): string[] {

    // просто children() не отдает текстовые ноды.
    let $childrenNodes = item.contents();
    let res: string[] = [];
    for (let i = 0; i < $childrenNodes.length; i++) {
        let el = $childrenNodes.get(i);
        if (el.nodeType === 3)
            res.push($(el).text());     // так как в разных браузерах текст запрашивается по разному, 
        // универсальный способ запросить через jquery
    }

    return res;
}


/**
 * По текстовой строке возвращает номер месяца начиная с 0 для января. Либо null
 * @param str очищенная от пробелов и лишних символов строка
 */
function monthFromStr(str: string) {
    let mnth = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
    for (let i = 0; i < mnth.length; i++) {
        if (str.indexOf(mnth[i]) === 0)
            return i;
    }

    return null;
}

function getRealm(): string | null {
    // https://*virtonomic*.*/*/main/globalreport/marketing/by_trade_at_cities/*
    // https://*virtonomic*.*/*/window/globalreport/marketing/by_trade_at_cities/*
    let rx = new RegExp(/https:\/\/virtonomic[A-Za-z]+\.[a-zA-Z]+\/([a-zA-Z]+)\/.+/ig);
    let m = rx.exec(document.location.href);
    if (m == null)
        return null;

    return m[1];
}

function getRealmOrError(): string {
    let realm = getRealm();
    if (realm === null)
        throw new Error("Не смог определить реалм по ссылке " + document.location.href);

    return realm;
}

function getCompanyId() {
    let str = matchedOrError($("a.dashboard").attr("href"), /\d+/);

    return numberfyOrError(str);
}

/**
 * Ищет паттерн в строке. Предполагая что паттерн там обязательно есть 1 раз. Если
 * нет или случился больше раз, валим ошибку
 * @param str строка в которой ищем
 * @param rx паттерн который ищем
 */
function matchedOrError(str: string, rx: RegExp, errMsg?: string): string {
    let m = str.match(rx);
    if (m == null)
        throw new Error(errMsg || `Паттерн ${rx} не найден в ${str}`);

    if (m.length > 1)
        throw new Error(errMsg || `Паттерн ${rx} найден в ${str} ${m.length} раз вместо ожидаемого 1`);

    return m[0];
}

let url_unit_list_rx = /\/[a-z]+\/(?:main|window)\/company\/view\/\d+(\/unit_list)?(\/xiooverview|\/overview)?$/i;     // список юнитов. Работает и для списка юнитов чужой компании
function isMyUnitList(): boolean {

    // для своих и чужих компани ссылка одна, поэтому проверяется и id
    if (url_unit_list_rx.test(document.location.pathname) === false)
        return false;

    // запрос id может вернуть ошибку если мы на window ссылке. значит точно у чужого васи
    try {
        let id = getCompanyId();
        let urlId = extractIntPositive(document.location.pathname) as number[]; // полюбому число есть иначе регекс не пройдет
        if (urlId[0] != id)
            return false;
    }
    catch (err) {
        return false;
    }

    return true;
}

function extractIntPositive(str: string): number[] | null {
    let m = cleanStr(str).match(/\d+/ig);
    if (m == null)
        return null;

    let n = m.map((val, i, arr) => numberfyOrError(val, -1));
    return n;
}

function numberfyOrError(str: string, minVal: number = 0, infinity: boolean = false) {
    let n = numberfy(str);
    if (!infinity && (n === Number.POSITIVE_INFINITY || n === Number.NEGATIVE_INFINITY))
        throw new RangeError("Получили бесконечность, что запрещено.");

    if (n <= minVal)
        throw new RangeError("Число должно быть > " + minVal);

    return n;
}

function cleanStr(str: string): string {
    return str.replace(/[\s\$\%\©]/g, "");
}

function numberfy(str: string): number {
    // возвращает либо число полученно из строки, либо БЕСКОНЕЧНОСТЬ, либо -1 если не получилось преобразовать.

    if (String(str) === 'Не огр.' ||
        String(str) === 'Unlim.' ||
        String(str) === 'Не обм.' ||
        String(str) === 'N’est pas limité' ||
        String(str) === 'No limitado' ||
        String(str) === '无限' ||
        String(str) === 'Nicht beschr.') {
        return Number.POSITIVE_INFINITY;
    } else {
        // если str будет undef null или что то страшное, то String() превратит в строку после чего парсинг даст NaN
        // не будет эксепшнов
        let n = parseFloat(cleanStr(String(str)));
        return isNaN(n) ? -1 : n;
    }
}

function buildStoreKey(realm: string | null, code: string, subid?: number): string {
    if (code.length === 0)
        throw new RangeError("Параметр code не может быть равен '' ");

    if (realm != null && realm.length === 0)
        throw new RangeError("Параметр realm не может быть равен '' ");

    if (subid != null && realm == null)
        throw new RangeError("Как бы нет смысла указывать subid и не указывать realm");

    let res = "^*";  // уникальная ботва которую добавляем ко всем своим данным
    if (realm != null)
        res += "_" + realm;

    if (subid != null)
        res += "_" + subid;

    res += "_" + code;

    return res;
}


/**
 * из даты формирует короткую строку типа 01.12.2017
 * @param date
 */
function dateToShort(date: Date): string {
    let d = date.getDate();
    let m = date.getMonth() + 1;
    let yyyy = date.getFullYear();

    let dStr = d < 10 ? "0" + d : d.toString();
    let mStr = m < 10 ? "0" + m : m.toString();

    return `${dStr}.${mStr}.${yyyy}`;
}

/**
 * из строки вида 01.12.2017 формирует дату
 * @param str
 */
function dateFromShort(str: string): Date {
    let items = str.split(".");

    let d = parseInt(items[0]);
    if (d <= 0)
        throw new Error("дата неправильная.");

    let m = parseInt(items[1]) - 1;
    if (m < 0)
        throw new Error("месяц неправильная.");

    let y = parseInt(items[2]);
    if (y < 0)
        throw new Error("год неправильная.");

    return new Date(y, m, d);
}


let $xioDebug = false;

function logDebug(msg: string, ...args: any[]) {
    if (!$xioDebug)
        return;

    console.log(msg, ...args);
}

interface IAction0 {
    (): void;
}

interface IAction1<T> {
    (arg: T): void;
}

/**
 * Запрашивает страницу. При ошибке поробует повторить запрос через заданное число секунд.
 * Пробует заданное число попыток, после чего возвращает reject.
 * При ресолве вернет текст страницы, а при реджекте вернет Error объект
 * @param url
 * @param retries число попыток загрузки
 * @param timeout таймаут между попытками
 * @param beforeGet вызывается перед каждым новым запросом. То есть число вызовов равно числу запросов. Каждый раз вызывается с урлом которые запрашивается.
 */
async function tryGet_async(url: string, retries: number = 10, timeout: number = 1000, beforeGet?: IAction1<string>, onError?: IAction1<string>): Promise<any> {
    // сам метод пришлось делать Promise<any> потому что string | Error не работало какого то хуя не знаю. Из за стрик нулл чек
    let $deffered = $.Deferred<string>();

    if (beforeGet) {
        try {
            beforeGet(url);
        }
        catch (err) {
            logDebug("beforeGet вызвал исключение", err);
        }
    }

    $.ajax({
        url: url,
        type: "GET",

        success: (data, status, jqXHR) => $deffered.resolve(data),

        error: function (this: JQueryAjaxSettings, jqXHR: JQueryXHR, textStatus: string, errorThrown: string) {

            if (onError) {
                try {
                    onError(url);
                }
                catch (err) {
                    logDebug("onError вызвал исключение", err);
                }
            }

            retries--;
            if (retries <= 0) {
                let err = new Error(`can't get ${this.url}\nstatus: ${jqXHR.status}\ntextStatus: ${jqXHR.statusText}\nerror: ${errorThrown}`);
                $deffered.reject(err);
                return;
            }

            //logDebug(`ошибка запроса ${this.url} осталось ${retries} попыток`);
            let _this = this;
            setTimeout(() => {
                if (beforeGet) {
                    try {
                        beforeGet(url);
                    }
                    catch (err) {
                        logDebug("beforeGet вызвал исключение", err);
                    }
                }

                $.ajax(_this);
            }, timeout);
        }
    });

    return $deffered.promise();
}



$(document).ready(() => Start_async());