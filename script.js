// ==UserScript==
// @name         My00sTVforPI
// @namespace    https://myretrotvs.com/
// @version      0.6.1
// @description  Fullscreen My00sTV video with a compact retro settings menu.
// @match        https://00s.myretrotvs.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    const INSTANCE_KEY = "__my00stvforpi_v051__";
    const STORAGE_KEY = "my00stvforpi.settings.v5";
    // Requires Firefox Autoplay to be set to "Allow Audio and Video".
    const AUTO_START = true;
    const DEFAULTS = Object.freeze({ fit: "cover", categories: null, year: null });
    const state = {
        cleanup: [],
        menuInstalled: false,
        playerReady: false,
        siteReady: false,
        powerRequested: false,
        playbackStarted: false,
        settings: loadSettings()
    };

    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = state;

    function loadSettings() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
                return { ...DEFAULTS };
            }

            const fit = stored.fit === "contain" ? "contain" : "cover";
            const categories = stored.categories && typeof stored.categories === "object" && !Array.isArray(stored.categories)
                ? Object.fromEntries(Object.entries(stored.categories).filter(([, value]) => typeof value === "boolean"))
                : null;
            const year = /^[0-9]$/.test(String(stored.year)) ? String(stored.year) : null;
            return { fit, categories, year };
        } catch {
            return { ...DEFAULTS };
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
        } catch {
            // Storage may be unavailable in a private or locked-down browser profile.
        }
    }

    function addEvent(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        state.cleanup.push(() => target.removeEventListener(type, listener, options));
    }

    function addStyle() {
        if (document.getElementById("my00stvforpi-style")) return;

        const style = document.createElement("style");
        style.id = "my00stvforpi-style";
        style.textContent = `
            html, body { width:100% !important; height:100% !important; margin:0 !important; padding:0 !important; overflow:hidden !important; background:#000 !important; }
            .wrapper { position:fixed !important; inset:0 !important; width:100vw !important; height:100vh !important; transform:none !important; opacity:1 !important; overflow:hidden !important; background:#000 !important; }
            .wrapper > *:not(#myytplayer) { display:none !important; }
            #myytplayer { position:fixed !important; display:block !important; visibility:visible !important; opacity:1 !important; left:50% !important; top:50% !important; transform:translate(-50%, -50%) !important; margin:0 !important; padding:0 !important; border:0 !important; max-width:none !important; max-height:none !important; z-index:10 !important; background:#000 !important; }
            #myytplayer iframe { display:block !important; visibility:visible !important; width:100% !important; height:100% !important; border:0 !important; }
            #my00stv { position:fixed; right:12px; bottom:12px; z-index:2147483647; font:12px Arial, sans-serif; color:#e6e6e6; }
            #my00stv-button, #my00stv-play { box-sizing:border-box; min-height:28px; padding:5px 9px; border:1px solid #6b6b6b; border-radius:0; background:#202020; color:#e6e6e6; font:12px Arial, sans-serif; letter-spacing:.04em; cursor:pointer; }
            #my00stv-button:hover, #my00stv-play:hover, #my00stv-button:focus-visible, #my00stv-play:focus-visible { border-color:#8ee78e; color:#baffba; outline:none; }
            #my00stv-play { display:none; position:absolute; right:0; bottom:35px; border-color:#579557; }
            #my00stv-play.visible { display:block; }
            #my00stv-panel { display:none; position:absolute; right:0; bottom:35px; width:min(330px, calc(100vw - 24px)); max-height:75vh; overflow:auto; box-sizing:border-box; padding:11px; border:1px solid #666; border-radius:0; background:#151515; box-shadow:3px 3px 0 #000; }
            #my00stv-panel.open { display:block; }
            #my00stv-panel.open ~ #my00stv-play { display:none; }
            #my00stv-panel h3 { margin:0 0 7px; color:#baffba; font:700 12px Arial, sans-serif; text-transform:uppercase; letter-spacing:.05em; }
            #my00stv-panel .section { margin:0 0 10px; padding:0 0 9px; border-bottom:1px solid #424242; }
            #my00stv-panel .section:last-child { margin-bottom:0; padding-bottom:0; border-bottom:0; }
            #my00stv-fit { width:100%; height:27px; padding:3px 5px; border:1px solid #777; border-radius:0; background:#262626; color:#eee; font:12px Arial, sans-serif; }
            #yearbar { display:flex !important; position:relative !important; visibility:visible !important; opacity:1 !important; left:auto !important; top:auto !important; width:100% !important; height:auto !important; flex-wrap:wrap !important; gap:2px 4px !important; margin:0 !important; overflow:visible !important; }
            #yearbar .year { display:inline-block !important; position:relative !important; visibility:visible !important; opacity:1 !important; left:auto !important; top:auto !important; min-width:38px; padding:3px 2px !important; text-align:center; border:1px solid transparent; font-family:Arial, sans-serif !important; line-height:1.1; }
            #yearbar .year:hover:not(.disabled), #yearbar .year.selected { border-color:#4a804a; background:#1d2a1d; }
            #tvfilters { display:block !important; position:relative !important; visibility:visible !important; opacity:1 !important; left:auto !important; top:auto !important; width:100% !important; height:auto !important; max-height:none !important; overflow:visible !important; padding:0 !important; margin:0 !important; background:transparent !important; }
            #tvfilters form { display:grid !important; grid-template-columns:18px 1fr; gap:4px 5px; align-items:center; margin:0; }
            #tvfilters input[type="checkbox"] { position:static !important; display:block !important; width:auto !important; height:auto !important; margin:0 !important; opacity:1 !important; cursor:pointer !important; accent-color:#5ca85c; }
            #tvfilters label[for^="box_"] { position:static !important; display:inline !important; width:auto !important; height:auto !important; min-height:0 !important; margin:0 !important; padding:0 !important; background:none !important; color:#e6e6e6 !important; font:12px Arial, sans-serif !important; cursor:pointer !important; }
            #tvfilters label.css-label-empty { color:#777 !important; cursor:default !important; }
            #tvfilters span { grid-column:1 / -1; margin-top:4px; color:#baffba !important; font:12px Arial, sans-serif !important; }
            #filter_all, #filter_none { color:#baffba !important; cursor:pointer !important; }
            @media (max-width:500px) { #my00stv { right:8px; bottom:8px; } #my00stv-panel { width:min(330px, calc(100vw - 16px)); } }
        `;
        const styleHost = document.head || document.documentElement;
        if (styleHost) styleHost.appendChild(style);
    }

    function resizeVideo() {
        const player = document.querySelector("#myytplayer");
        if (!player) return;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const sixteenByNineWidth = viewportHeight * 16 / 9;
        const sixteenByNineHeight = viewportWidth * 9 / 16;
        const width = state.settings.fit === "cover"
            ? Math.max(viewportWidth, sixteenByNineWidth)
            : Math.min(viewportWidth, sixteenByNineWidth);
        const height = state.settings.fit === "cover"
            ? Math.max(viewportHeight, sixteenByNineHeight)
            : Math.min(viewportHeight, sixteenByNineHeight);

        player.style.setProperty("width", `${width}px`, "important");
        player.style.setProperty("height", `${height}px`, "important");
    }

    function getCategoryInputs() {
        return [...document.querySelectorAll('#tvfilters input[type="checkbox"][id^="box_"]')];
    }

    function saveCategories() {
        const inputs = getCategoryInputs();
        if (!inputs.length) return;
        state.settings.categories = Object.fromEntries(inputs.map(input => [input.id, input.checked]));
        saveSettings();
    }

    function saveYear() {
        const selected = document.querySelector("#yearbar .year.selected");
        if (!selected) return;
        state.settings.year = selected.getAttribute("name");
        saveSettings();
    }

    function restoreSettings() {
        if (state.settings.categories) {
            for (const input of getCategoryInputs()) {
                const wanted = state.settings.categories[input.id];
                if (typeof wanted === "boolean" && !input.disabled && input.checked !== wanted) {
                    // This invokes the website's existing filter event handler.
                    input.click();
                }
            }
        }

        if (state.settings.year !== null) {
            const year = [...document.querySelectorAll("#yearbar .year")]
                .find(item => item.getAttribute("name") === state.settings.year);
            if (year && !year.classList.contains("disabled") && !year.classList.contains("selected")) {
                // This invokes the website's existing year-selection event handler.
                year.click();
            }
        }

        saveCategories();
        saveYear();
    }

    function createMenu() {
        if (state.menuInstalled || document.getElementById("my00stv")) return;

        const yearbar = document.querySelector("#yearbar");
        const filters = document.querySelector("#tvfilters");
        if (!yearbar || !filters) return;

        const root = document.createElement("div");
        root.id = "my00stv";
        root.innerHTML = `
            <div id="my00stv-panel" aria-label="My00sTV settings">
                <div class="section"><h3>Screen fit</h3><select id="my00stv-fit"><option value="cover">Fill (cover)</option><option value="contain">Fit (contain)</option></select></div>
                <div class="section"><h3>Year</h3><div id="my00stv-years"></div></div>
                <div class="section"><h3>Categories</h3><div id="my00stv-categories"></div></div>
            </div>
            <button id="my00stv-play" type="button" aria-label="Start video">START</button>
            <button id="my00stv-button" type="button" aria-expanded="false">MENU</button>
        `;
        document.body.appendChild(root);
        root.querySelector("#my00stv-years").appendChild(yearbar);
        root.querySelector("#my00stv-categories").appendChild(filters);

        const panel = root.querySelector("#my00stv-panel");
        const menuButton = root.querySelector("#my00stv-button");
        const playButton = root.querySelector("#my00stv-play");
        const fit = root.querySelector("#my00stv-fit");
        fit.value = state.settings.fit;

        menuButton.addEventListener("click", () => {
            const open = panel.classList.toggle("open");
            menuButton.setAttribute("aria-expanded", String(open));
        });
        fit.addEventListener("change", () => {
            state.settings.fit = fit.value === "contain" ? "contain" : "cover";
            saveSettings();
            resizeVideo();
        });
        playButton.addEventListener("click", () => {
            if (!state.powerRequested) {
                const power = document.querySelector("#btn_power");
                if (!power) return;
                state.powerRequested = true;
                playButton.textContent = "LOADING";
                playButton.disabled = true;
                // This handler is entered through a real user click. The website's own
                // Power handler therefore loads the clip while Firefox user activation is live.
                power.click();
                return;
            }

            // A single user-initiated retry for a player that explicitly reports autoplay blocked.
            const iframe = document.querySelector("#myytplayer iframe");
            if (!iframe?.contentWindow) return;
            try {
                iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), new URL(iframe.src).origin);
            } catch {
                // The compact control remains available if the iframe cannot accept commands.
            }
        });
        state.menuInstalled = true;
    }

    function originalSiteIsReady() {
        const yearbar = document.querySelector("#yearbar");
        const filters = document.querySelector("#tvfilters");
        return !document.querySelector("#loader") &&
            yearbar?.querySelectorAll(".year").length === 10 &&
            filters?.querySelectorAll('input[id^="box_"]').length > 0 &&
            [...filters.querySelectorAll('label[for^="box_"]')].some(label => label.textContent.trim());
    }

    function showStartControl() {
        if (!state.siteReady) return;
        document.querySelector("#my00stv-play")?.classList.add("visible");
    }

    function requestAutomaticStart() {
        if (!AUTO_START || !state.siteReady || state.powerRequested) return;
        const power = document.querySelector("#btn_power");
        if (!power) return;
        state.powerRequested = true;
        // Uses the original website's complete startup path. Firefox must explicitly
        // allow audible autoplay for this programmatic action to begin playback.
        power.click();
    }

    function installWhenSiteReady() {
        if (state.siteReady || !originalSiteIsReady()) return;
        state.siteReady = true;
        createMenu();
        restoreSettings();
        resizeVideo();
        state.playerReady = true;
        showStartControl();
        requestAutomaticStart();
    }

    function isYouTubeOrigin(origin) {
        try {
            const host = new URL(origin).hostname;
            return host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com");
        } catch {
            return false;
        }
    }

    function isCurrentPlayerMessage(event) {
        const iframe = document.querySelector("#myytplayer iframe");
        return Boolean(iframe && iframe.contentWindow === event.source && isYouTubeOrigin(event.origin));
    }

    function readYouTubeMessage(data) {
        if (typeof data === "string") {
            try { return JSON.parse(data); } catch { return null; }
        }
        return data && typeof data === "object" ? data : null;
    }

    function onPlayerMessage(event) {
        if (!isCurrentPlayerMessage(event)) return;
        const message = readYouTubeMessage(event.data);
        if (!message) return;

        if (message.event === "onReady") {
            state.playerReady = true;
            showStartControl();
            requestAutomaticStart();
        } else if (message.event === "onStateChange" && Number(message.info) === 1) {
            state.playbackStarted = true;
            document.querySelector("#my00stv-play")?.classList.remove("visible");
        } else if (message.event === "onAutoplayBlocked") {
            // The website already loaded the clip. Firefox requires a real user gesture to resume it.
            const playButton = document.querySelector("#my00stv-play");
            if (playButton) {
                playButton.disabled = false;
                playButton.textContent = "PLAY";
                playButton.classList.add("visible");
            }
        }
    }

    function observePage() {
        if (!document.documentElement) {
            document.addEventListener("DOMContentLoaded", observePage, { once: true });
            return;
        }
        const observer = new MutationObserver(() => {
            addStyle();
            resizeVideo();
            installWhenSiteReady();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        state.cleanup.push(() => observer.disconnect());
    }

    function teardown() {
        for (const clean of state.cleanup.splice(0)) clean();
        delete window[INSTANCE_KEY];
    }

    addStyle();
    observePage();
    addEvent(window, "message", onPlayerMessage);
    addEvent(window, "resize", resizeVideo, { passive: true });
    addEvent(window, "orientationchange", resizeVideo, { passive: true });
    addEvent(document, "click", event => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest('#tvfilters input[id^="box_"], #filter_all, #filter_none')) {
            queueMicrotask(saveCategories);
        }
        if (event.target.closest("#yearbar .year")) {
            queueMicrotask(saveYear);
        }
    });
    addEvent(window, "pagehide", teardown, { once: true });

    // Covers a userscript injected into an already-built document without using a timer.
    if (document.readyState !== "loading") {
        resizeVideo();
        installWhenSiteReady();
    }
})();
