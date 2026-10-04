/* =========================================================================
   30 — switches the teaser to the broadcast at showtime.
   The showtime is the earliest of the times listed on the page. Visitors
   who arrive early are switched over live, without reloading.
   Visitors who arrive after showtime see the teaser at rest, which then
   plays its entrance backwards into the video.
   Add ?live to the URL to preview the broadcast before then.
   ========================================================================= */

const VIMEO_SRC = "https://player.vimeo.com/video/1232689852";

// Pares the player down to play/pause, volume and captions. Some of these
// only take effect on a paid Vimeo plan.
const VIMEO_PARAMS = {
  title: 0,
  byline: 0,
  portrait: 0,
  badge: 0,
  vimeo_logo: 0,
  autopause: 0,
  dnt: 1,
  progress_bar: 0,
  fullscreen: 0,
  pip: 0,
  airplay: 0,
  chromecast: 0,
  speed: 0,
  quality_selector: 0,
  transcript: 0,
  share: 0,
  like: 0,
  watch_later: 0,
  collections: 0,
};

const showtime = Math.min(
  ...[...document.querySelectorAll(".time time")].map((t) => Date.parse(t.dateTime))
);
const preview = new URLSearchParams(location.search).has("live");

// How long a visitor arriving after showtime sees the teaser before it goes.
const HOLD = 1000;

let timer;

function goLive() {
  clearTimeout(timer);
  document.removeEventListener("visibilitychange", check);

  const src = new URL(VIMEO_SRC);
  for (const [key, value] of Object.entries(VIMEO_PARAMS)) {
    src.searchParams.set(key, value);
  }

  const frame = document.createElement("iframe");
  frame.src = src;
  frame.title = "October Event";
  frame.allow = "autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.allowFullscreen = true;

  // The video starts loading while the teaser plays out. The leftmost icon
  // is the last thing to dissolve; once it's gone, the video dissolves in.
  document.querySelector(".player").append(frame);
  document.querySelector(".graphic img:first-child").addEventListener(
    "animationend",
    () => document.body.classList.replace("leaving", "live"),
    { once: true }
  );
  document.body.classList.remove("settled");
  document.body.classList.add("leaving");
}

// Re-checks at least once a minute, and whenever the tab comes back into
// view, so a sleeping laptop or throttled background tab still switches.
function check() {
  clearTimeout(timer);
  const wait = showtime - Date.now();
  if (wait <= 0) return goLive();
  timer = setTimeout(check, Math.min(wait, 60_000));
}

if (preview || Date.now() >= showtime) {
  document.body.classList.add("settled");
  timer = setTimeout(goLive, HOLD);
} else {
  document.addEventListener("visibilitychange", check);
  check();
}
