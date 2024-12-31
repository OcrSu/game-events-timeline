"use strict";

window.remainingTimeInterval = null;
window.totalDays = 0;
window.pxPerDay = 36;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        window.socket = connectWebSocket(token);
        loadEvents(socket);
    } else {
        loadEvents();
    }
    const legendContainer = document.querySelector('.legend-inner');
});

let eventsSettings = {};
function loadEvents(socket) {
    fetch('game-events/getnotice')
        .then(response => response.json())
        .then(data => {
            const events = [];
            ['ys', 'sr', 'zzz', 'ww'].forEach(type => {
                if (Array.isArray(data[type])) {
                    data[type].forEach(event => {
                        const newEvent = {
                            start: new Date(event.start_time),
                            end: new Date(event.end_time),
                            name: type === 'ww' ? (event.title.includes("[") ? extractTitle(event.title) : event.title) : extractTitle(event.title),
                            color: getColor(type),
                            bannerImage: event.bannerImage,
                            uuid: event.uuid,
                            game: type,
                            type: event.event_type,
                        };
                        if (newEvent.bannerImage === "") {
                            if (newEvent.game === "sr") {
                                newEvent.bannerImage = "/static/images/sr.png";
                            }
                        }
                        events.push(newEvent);
                    });
                }
            });

            if (events.length > 0) {
                updateCurrentTimeMarker();
                createTimeline(events);
                setInterval(updateCurrentTimeMarker, 100);
                createLegend();
                const savedSettings = localStorage.getItem('events_setting');
                if (savedSettings) {
                    eventsSettings = JSON.parse(savedSettings);
                }
                loadHiddenStatus();
                loadCompletionStatus();
            } else {
                const legendContainer = document.querySelector('.legend-list');
                legendContainer.innerHTML = "当前无事件";
            }
        })
        .catch(error => console.error('Error loading events:', error));
}


function createTimeline(events) {
    const timeline = document.querySelector('.timeline');
    const timeline_container = document.querySelector('.timeline-container');
    const dateAxis = document.querySelector('.date-axis');

    const earliestStart = new Date(Math.min(...events.map(event => event.start.getTime())));
    const latestEnd = new Date(Math.max(...events.map(event => event.end.getTime())));

    const timelineStart = new Date(earliestStart);
    timelineStart.setDate(timelineStart.getDate() - 5);
    timelineStart.setHours(0, 0, 0, 0);

    const timelineEnd = new Date(latestEnd);
    timelineEnd.setDate(timelineEnd.getDate() + 5);
    timelineEnd.setHours(0, 0, 0, 0);

    const totalTimeInMs = timelineEnd - timelineStart;

    window.totalDays = Math.ceil((timelineEnd - timelineStart) / (1000 * 60 * 60 * 24));
    for (let i = 0; i <= totalDays; i++) {
        const currentDate = new Date(timelineStart);
        currentDate.setDate(currentDate.getDate() + i);
        const label = document.createElement('div');
        label.classList.add('date-label');
        label.style.left = i * pxPerDay + "px";
        if (isToday(currentDate)) {
            label.classList.add('today');
        }
        label.dataset.date = formatLocalDate(currentDate);
        const line = document.createElement('div');
        line.style.marginLeft = i * pxPerDay - 10 + "px";
        line.classList.add('date-label-line');
        if (currentDate.Format("d") === "1" || isSameDate(currentDate, timelineStart)) {
            label.innerHTML = `<div class="month-day first-day">${currentDate.Format("M月")}</div><div class="week-day" style="width:35px">${formatWeekDay(currentDate)}</idv>`;
            if (isSameDate(currentDate, timelineStart)) {
                label.style.width = (getDaysInMonth2(currentDate) - timelineStart.Format("d") + 1) * pxPerDay - pxPerDay / 1.2 + "px";
                label.style.paddingRight = pxPerDay / 1.2 + "px";
            } else if (currentDate.Format("M") === timelineEnd.Format("M")) {
                label.style.width = (timelineEnd.Format("d")) * pxPerDay + pxPerDay / 2 - pxPerDay / 1.2 + "px";
                label.style.paddingRight = pxPerDay / 1.2 + "px";
            } else {
                label.style.width = getDaysInMonth2(currentDate) * pxPerDay - pxPerDay / 1.2 + "px";
                label.style.paddingRight = pxPerDay / 1.2 + "px";
            }
            label.style.marginLeft = "-8px";
            line.style.marginLeft = i * pxPerDay - 11 + "px";
            line.style.width = "3px";
            line.style.backgroundColor = "#ccc";
        } else {
            line.style.marginLeft = i * pxPerDay - 10 + "px";
            label.innerHTML = `<div class="month-day today-date">${currentDate.Format("d")}</div><div class="week-day">${formatWeekDay(currentDate)}</idv>`;
        }
        dateAxis.appendChild(label);
        dateAxis.appendChild(line);
    }
    const line = document.createElement('div');
    line.style.marginLeft = (totalDays + 1) * pxPerDay - 10 + "px";
    line.classList.add('date-label-line');
    dateAxis.appendChild(line);

    events.forEach((event, index) => {
        const eventElement = document.createElement('div');
        eventElement.classList.add('event');
        eventElement.dataset.start = event.start.getTime();
        eventElement.dataset.end = event.end.getTime();
        eventElement.dataset.bannerImage = event.bannerImage;
        eventElement.dataset.uuid = event.uuid;
        eventElement.dataset.game = event.game;
        eventElement.style.backgroundColor = event.color;

        const eventStartOffset = (event.start.getTime() - timelineStart.getTime()) / totalTimeInMs;
        const eventDuration = (event.end.getTime() - event.start.getTime()) / totalTimeInMs;

        eventElement.style.left = `${eventStartOffset * 100}%`;
        eventElement.style.width = (event.end.getTime() - event.start.getTime()) / (86400 / pxPerDay * 1000) - 10 + "px";
        eventElement.style.top = `${index * 30 + index * 8}px`;

        const eventTitleDiv = document.createElement('div');
        eventTitleDiv.classList.add('event-title');

        const timeRemainingSpan = document.createElement('div');
        timeRemainingSpan.classList.add('time-remaining');
        eventElement.appendChild(timeRemainingSpan);

        const completionBox = document.createElement('div');
        completionBox.classList.add('completion-box');
        completionBox.style.border = '2px dashed lightgrey';
        completionBox.style.backgroundColor = 'rgba(225, 225, 225, 0.5)';
        completionBox.dataset.status = '0';
        completionBox.addEventListener('click', toggleCompletionStatus);
        eventTitleDiv.appendChild(completionBox);

        const eventTitle = document.createElement('span');
        eventTitle.innerHTML = `${event.name}`;
        eventTitleDiv.appendChild(eventTitle);

        refreshRemainTime(event);
        function refreshRemainTime(event) {
            const now = new Date();
            const timeRemaining = event.end.getTime() - now.getTime();
            const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            timeRemainingSpan.textContent = `${days}天 ${hours}小时`;
            const timeRemainingWidth = timeRemainingSpan.offsetWidth;
            timeRemainingSpan.style.right = `-${(timeRemainingWidth === 0 ? 90 : timeRemainingWidth) + 10}px`;
        }

        setInterval(() => {
            refreshRemainTime(event);
        }, 100);

        eventElement.addEventListener('click', function () {
            document.querySelectorAll('.event').forEach(e => {
                if (e.style.borderTopWidth === "3px") {
                    e.style.border = 'none';
                    e.style.top = parseInt(e.style.top) + 3 + "px";
                }
            });

            eventElement.style.border = '3px solid white';
            eventElement.style.top = parseInt(eventElement.style.top) - 3 + "px";

            if (event.bannerImage) {
                showBannerWithInfo(event);
            }
        });

        const now = new Date();
        const timeRemainingInMs = event.end.getTime() - now.getTime();
        const oneDayInMs = 1000 * 60 * 60 * 24;

        if (timeRemainingInMs <= oneDayInMs + oneDayInMs / 2) {
            eventElement.style.backgroundImage = `linear-gradient(to right, ${event.color} calc(100% - 252px), red 100%)`;
        } else if (timeRemainingInMs <= 3 * oneDayInMs + oneDayInMs / 2) {
            eventElement.style.backgroundImage = `linear-gradient(to right, ${event.color} calc(100% - 252px), #FF5000 100%)`;
        }

        eventElement.appendChild(eventTitleDiv);

        // 创建并添加带有 bannerImage 的 div
        const bannerDiv = document.createElement('div');
        bannerDiv.classList.add('event-banner');
        bannerDiv.style.backgroundImage = `url(${event.bannerImage})`;
        if (event.type === "gacha") {
            if (event.game === "ys") {
                bannerDiv.style.backgroundPosition = 'center 45px';
            } else if (event.game === "sr") {
                bannerDiv.style.backgroundPosition = 'center 25px';
            } else if (event.game === "zzz") {
                bannerDiv.style.backgroundPosition = 'center 34px';
            } else {
                if (!event.name.includes("武器")) {
                    bannerDiv.style.backgroundPosition = 'center 35%';
                }
                else {
                    bannerDiv.style.backgroundPosition = 'center center';
                }
            }
        } else {
            bannerDiv.style.backgroundPosition = 'center';
        }
        bannerDiv.style.position = 'absolute';
        bannerDiv.style.right = '0';
        bannerDiv.style.top = '0';
        bannerDiv.style.bottom = '0';
        bannerDiv.style.width = '100px'; // 你可以根据需要调整宽度
        // console.log(event)
        eventElement.appendChild(bannerDiv);

        timeline.appendChild(eventElement);
        updateCurrentTimeMarker();

        timeline.style.marginLeft = "20px";
        timeline.style.width = totalDays * pxPerDay + "px";

        const currentOffset = (now.getTime() - timelineStart.getTime()) / totalTimeInMs;
        timeline_container.scrollLeft = currentOffset * totalDays * pxPerDay - timeline_container.offsetWidth / 2 + 20;
    });

    const linestylediv = document.createElement("style");
    linestylediv.innerHTML = `.date-label-line {height:${(timeline.children.length) * 40 - 15}px!important;}`;
    document.body.appendChild(linestylediv);
    setInterval(updateTodayHighlight, 500);

    loadCompletionStatus();
}

function updateCurrentTimeMarker() {
    const timeline = document.querySelector('.timeline');
    const currentTimeMarker = document.querySelector('.current-time-marker') || document.createElement('div');
    const currentTimeLabel = document.querySelector('.current-time-label') || document.createElement('div');

    const now = new Date();
    const events = Array.from(document.querySelectorAll('.event'));

    const eventStartTimes = events.map(event => new Date(Number(event.dataset.start)));
    const eventEndTimes = events.map(event => new Date(Number(event.dataset.end)));
    const timelineStart = new Date(Math.min(...eventStartTimes));
    const timelineEnd = new Date(Math.max(...eventEndTimes));

    timelineStart.setDate(timelineStart.getDate() - 5);
    timelineStart.setHours(0, 0, 0, 0);
    timelineEnd.setDate(timelineEnd.getDate() + 5);
    timelineEnd.setHours(0, 0, 0, 0);

    const totalTimeInMs = timelineEnd - timelineStart;

    const currentOffset = (now.getTime() - timelineStart.getTime()) / totalTimeInMs;
    const offsetLeft = (now.getTime() - timelineStart.getTime()) / (86400 / pxPerDay * 1000) + "px";

    currentTimeMarker.classList.add('current-time-marker');
    currentTimeMarker.style.height = (document.querySelector(".timeline").children.length - 2) * 40 + "px";
    currentTimeMarker.style.left = offsetLeft;
    currentTimeMarker.style.display = 'block';

    currentTimeLabel.classList.add('current-time-label');
    currentTimeLabel.textContent = `${formatTime(now)}`;
    currentTimeLabel.style.left = offsetLeft;

    if (!document.querySelector('.current-time-marker')) {
        timeline.appendChild(currentTimeMarker);
    }
    if (!document.querySelector('.current-time-label')) {
        timeline.appendChild(currentTimeLabel);
    }
}

function updateTodayHighlight() {
    const today = formatLocalDate(new Date());
    document.querySelectorAll('.date-label').forEach(label => {
        const labelDate = label.dataset.date;
        if (labelDate === today) {
            label.classList.add('today');
            if (!label.children[0].classList.contains("first-day")) {
                label.children[0].classList.add('today-date');
            }
        } else {
            label.classList.remove('today');
            label.children[0].classList.remove('today-date');
        }
    });
}

function showBannerWithInfo(event) {
    const bannerContainer = document.querySelector('.banner-img-container');
    const bannerImage = bannerContainer.querySelector('.banner-img');
    const eventNameElem = bannerContainer.querySelector('.event-name');
    const eventStartDateElem = bannerContainer.querySelector('.event-start-date');
    const eventEndDateElem = bannerContainer.querySelector('.event-end-date');
    const eventRemainingTimeElem = bannerContainer.querySelector('.event-remaining-time');

    if (remainingTimeInterval) {
        clearInterval(remainingTimeInterval);
        remainingTimeInterval = null;
    }

    bannerImage.src = event.bannerImage;
    if (event.name.includes("】") && event.name.includes(":")) {
        let name = event.name.split(":");
        eventNameElem.innerHTML = `${name[0]}<br>${name[1]}`;
    } else {
        eventNameElem.textContent = `${event.name}`;
    }
    eventStartDateElem.textContent = `📣 ${formatDateTime(event.start)}`;
    eventEndDateElem.textContent = `🛑 ${formatDateTime(event.end)}`;

    const updateRemainingTime = () => {
        const now = new Date();
        const timeRemaining = event.end.getTime() - now.getTime();
        const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        const formattedHours = hours.toString().padStart(2, '0');
        const formattedMinutes = minutes.toString().padStart(2, '0');
        const formattedSeconds = seconds.toString().padStart(2, '0');

        eventRemainingTimeElem.textContent = `⏳ ${days}天 ${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    };

    updateRemainingTime();
    window.remainingTimeInterval = setInterval(updateRemainingTime, 100);

    bannerContainer.style.display = 'block';

    const closeBtn = bannerContainer.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        bannerContainer.style.display = 'none';
        clearInterval(remainingTimeInterval);
        remainingTimeInterval = null;
        document.querySelectorAll('.event').forEach(e => {
            if (e.style.borderTopWidth === "3px") {
                e.style.border = 'none';
                e.style.top = parseInt(e.style.top) + 3 + "px"
            }
        });
    }, { once: true });
}

function createLegend() {
    const legendContainer = document.querySelector('.legend-list');
    legendContainer.innerHTML = "";
    const activityTypes = [
        { type: 'ys', name: '原神' },
        { type: 'sr', name: '崩坏：星穹铁道' },
        { type: 'zzz', name: '绝区零' },
        { type: 'ww', name: '鸣潮' }
    ];

    activityTypes.forEach(activity => {
        const legendItem = document.createElement('div');
        legendItem.classList.add('legend-item');

        const colorBox = document.createElement('span');
        colorBox.dataset.game = activity.type;
        colorBox.classList.add('color-box');
        colorBox.style.backgroundColor = getColor(activity.type);

        // 添加点击事件监听器
        colorBox.addEventListener('click', () => toggleGameEventsVisibility(activity.type));

        const label = document.createElement('span');
        label.classList.add('label');
        label.textContent = activity.name;

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContainer.appendChild(legendItem);
    });
}

window.hiddenEvents = {}; // 存储每个事件的隐藏状态

function toggleGameEventsVisibility(gameType) {
    const events = document.querySelectorAll('.event');

    events.forEach(event => {
        if (event.dataset.game === gameType) {
            const uuid = event.dataset.uuid;
            const isHidden = window.hiddenEvents[uuid] || false;

            // 切换隐藏状态
            window.hiddenEvents[uuid] = !isHidden;
            event.style.display = isHidden ? 'flex' : 'none';
            // 更新 eventsSettings
            if (!eventsSettings[uuid]) {
                eventsSettings[uuid] = {};
            }
            eventsSettings[uuid].isHidden = !isHidden;
        }
    });
    recalculateEventPositions();
    updateColorBoxStyle(gameType);
    saveEventsSettings();
}

function saveEventsSettings() {
    localStorage.setItem('events_setting', JSON.stringify(eventsSettings));
    updateSettings(eventsSettings, socket);
}

function recalculateEventPositions() {
    const events = document.querySelectorAll('.event');
    let currentTop = 0; // 当前事件的顶部位置

    events.forEach(event => {
        if (event.style.display !== 'none') {
            // 如果事件未隐藏，调整其位置
            event.style.top = `${currentTop}px`;
            currentTop += event.offsetHeight + 8; // 增加事件高度和间距
        }
    });
}

function loadHiddenStatus() {
    const events = document.querySelectorAll('.event');

    events.forEach(event => {
        const uuid = event.dataset.uuid;
        const isHidden = eventsSettings[uuid]?.isHidden || false;

        if (isHidden) {
            event.style.display = 'none';
        } else {
            event.style.display = 'flex';
        }
    });
    initializeColorBoxStyles();
    recalculateEventPositions();
}


function updateColorBoxStyle(gameType) {
    const colorBox = document.querySelector(`.color-box[data-game="${gameType}"]`);
    if (!colorBox) return;

    // 检查当前游戏类型的事件是否全部隐藏
    const isAllHidden = Array.from(document.querySelectorAll(`.event[data-game="${gameType}"]`)).every(event => event.style.display === 'none');
    // console.log(isAllHidden)

    if (isAllHidden) {
        // 如果全部隐藏，设置为虚线边框空心
        // colorBox.style.width = "17px";
        // colorBox.style.height = "17px";
        colorBox.style.border = '2px dashed ' + getColor(gameType);
        colorBox.style.backgroundColor = 'transparent';
    } else {
        // 如果显示，设置为实心
        // colorBox.style.width = "20px";
        // colorBox.style.height = "20px";
        // colorBox.style.border = 'none';
        colorBox.style.border = '2px solid ' + getColor(gameType);
        colorBox.style.backgroundColor = getColor(gameType);
    }
}

function initializeColorBoxStyles() {
    const activityTypes = ['ys', 'sr', 'zzz', 'ww']; // 游戏类型

    activityTypes.forEach(gameType => {
        updateColorBoxStyle(gameType);
    });
}

function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
}

function getColor(type) {
    const colors = {
        sr: '#E0A064',
        ww: '#18A0E8',
        ys: '#A068F8',
        zzz: '#4CAF50',
    };
    return colors[type] || '#FFFFFF';
}

function extractTitle(title) {
    const regex = /[「\[]([^「\]」]+)[」\]]/;
    const match = regex.exec(title);
    return match ? match[1] : title;
}

function formatLocalDate(date) {
    return date.Format("yyyy-MM-dd");
}

function formatDate(date) {
    return date.Format("MM-dd");
}

function formatTime(date) {
    return date.Format("HH:mm:ss");
}

function formatDateTime(date) {
    return date.Format("yyyy-MM-dd HH:mm:ss");
}

function formatDateTime2(date) {
    return date.Format("yyyy-MM-dd HH:mm");
}

function formatWeekDay(date) {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${weekDays[date.getDay()]}`;
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getDaysInMonth2(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
}

function isSameDate(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

document.querySelector('.timeline-container').addEventListener('wheel', (event) => {
    event.preventDefault();
    const scrollAmount = event.deltaY;
    event.currentTarget.scrollLeft += scrollAmount;
});

document.querySelector('.close-btn').addEventListener('click', function () {
    document.querySelector('.banner-img-container').style.display = 'none';
});

function toggleCompletionStatus(event) {
    event.stopPropagation();
    const box = event.target;
    const eventElement = box.closest('.event');
    const uuid = eventElement.dataset.uuid;
    const currentStatus = box.dataset.status;
    let newStatus;

    switch (currentStatus) {
        case '0':
            newStatus = '1';
            box.style.border = '2px solid lightgreen';
            box.style.backgroundColor = '#6f67';
            box.innerHTML = "✅"
            break;
        case '1':
            newStatus = '2';
            box.style.border = '2px solid yellow';
            box.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
            box.innerHTML = "⏩"
            break;
        case '2':
            newStatus = '0';
            box.style.border = '2px dashed lightgrey';
            box.style.backgroundColor = 'rgba(225, 225, 225, 0.5)';
            box.innerHTML = ""
            break;
    }

    box.dataset.status = newStatus;
    if (!eventsSettings[uuid]) {
        eventsSettings[uuid] = {};
    }
    eventsSettings[uuid].isCompleted = newStatus;
    saveEventsSettings();
}


function loadCompletionStatus() {
    const events = document.querySelectorAll('.event');

    events.forEach(event => {
        const uuid = event.dataset.uuid;
        const completionBox = event.querySelector('.completion-box');
        const status = eventsSettings[uuid]?.isCompleted || '0';

        completionBox.dataset.status = status;

        switch (status) {
            case '1':
                completionBox.style.border = '2px solid lightgreen';
                completionBox.style.backgroundColor = '#6f67';
                completionBox.innerHTML = "✅";
                break;
            case '2':
                completionBox.style.border = '2px solid yellow';
                completionBox.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
                completionBox.innerHTML = "⏩";
                break;
            default:
                completionBox.style.border = '2px dashed lightgrey';
                completionBox.style.backgroundColor = 'rgba(225, 225, 225, 0.5)';
                completionBox.innerHTML = "";
                break;
        }
    });
}

Date.prototype.Format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1,
        "d+": this.getDate(),
        "H+": this.getHours(),
        "m+": this.getMinutes(),
        "s+": this.getSeconds(),
        "q+": Math.floor((this.getMonth() + 3) / 3),
        "S": this.getMilliseconds()
    };
    fmt = fmt.replace(/(y+)/, (match, p1) => {
        return (this.getFullYear() + "").slice(-p1.length);
    });
    for (var k in o) {
        fmt = fmt.replace(new RegExp("(" + k + ")"), (match, p1) => {
            return p1.length == 1 ? o[k] : ("00" + o[k]).slice(-p1.length);
        });
    }
    return fmt;
}

function changeTime(t) {
    const OriginalDate = Date;
    const customTime = new OriginalDate(t);
    const offset = customTime.getTime() - OriginalDate.now();

    window.Date = function (...args) {
        if (args.length === 0) {
            return new OriginalDate(OriginalDate.now() + offset);
        } else {
            return new OriginalDate(...args);
        }
    };

    Date.now = function () {
        return OriginalDate.now() + offset;
    };

    Date.UTC = OriginalDate.UTC;
    Date.parse = OriginalDate.parse;
    Date.prototype = OriginalDate.prototype;
}
