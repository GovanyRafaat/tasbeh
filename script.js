let tasbe7na = [];
let songs = [];
let bible = [];
let allHymns = []; // قائمة موحدة لكل الترانيم
let currentFontColor = "#ffffff";
let currentShadow = false;

/* تحميل البيانات */

// Register Service Worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('ServiceWorker registered:', registration);
        // Force update check
        registration.update();
      })
      .catch(error => console.log('ServiceWorker registration failed:', error));
  });
}

// Handle PWA installation
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  console.log('PWA: ready for installation');
});

async function loadData() {
  try {
    // 1. تحميل tasbe7naDB.json
    try {
      const responseTasbe7na = await fetch("tasbe7naDB.json");
      if (responseTasbe7na.ok) {
        tasbe7na = await responseTasbe7na.json();
        console.log(`تم تحميل ${tasbe7na.length} ترنيمة من tasbe7naDB.json`);
      } else {
        console.error("فشل تحميل tasbe7naDB.json: ", responseTasbe7na.statusText);
      }
    } catch (e) {
      console.error("خطأ في fetch tasbe7naDB.json: ", e);
    }

    // 2. تحميل songs.json
    try {
      const responseSongs = await fetch("songs.json");
      if (responseSongs.ok) {
        const songsData = await responseSongs.json();
        // songs.json قد يكون مصفوفة مباشرة أو كائن يحتوي على "value"
        if (Array.isArray(songsData)) {
          songs = songsData;
        } else if (songsData && Array.isArray(songsData.value)) {
          songs = songsData.value;
        } else {
          console.warn("تنسيق غير متوقع لملف songs.json");
        }
        console.log(`تم تحميل ${songs.length} ترنيمة من songs.json`);
      } else {
        console.error("فشل تحميل songs.json: ", responseSongs.statusText);
      }
    } catch (e) {
      console.error("خطأ في fetch songs.json: ", e);
    }

    // تجهيز ودمج البيانات
    const preparedTasbe7na = (tasbe7na || []).map(s => prepareSearchFields(s));
    const preparedSongs = (songs || []).map(s => prepareSearchFields(s));
    
    allHymns = [...preparedTasbe7na, ...preparedSongs];
    console.log(`إجمالي الترانيم الجاهزة للبحث: ${allHymns.length}`);
    
    // 3. تحميل bible.json
    try {
      const responseBible = await fetch("bible.json");
      if (responseBible.ok) {
        bible = await responseBible.json();
        console.log("تم تحميل الكتاب المقدس بنجاح");
      }
    } catch (e) {
      console.error("خطأ في تحميل bible.json: ", e);
    }
    
    displayResults([]);
    updateBgControls();
  } catch (error) {
    console.log("فشل تحميل البيانات بشكل عام", error);
  }
}

loadData();

/* عرض النتائج */

function displayResults(list) {
  const container = document.getElementById("songsContainer");
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = "";
    return;
  }

  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "song";

    // إذا كان العنصر من الكتاب المقدس
    if (item.isBible) {
      div.textContent = `${item.bookName} ${item.chapterNumber}`;
      div.addEventListener("click", function () {
        openBiblePresentation(item);
      });
    } else {
      const title = item.title || item.name || "ترنيمة";
      div.textContent = title;
      div.addEventListener("click", function () {
        openPresentation(item);
      });
    }

    div.style.color = "#000000";
    div.style.textShadow = "none";

    container.appendChild(div);
  });
}

/* الشاشة الخارجية */

let externalWindow = null;
let externalScreenImageUrl = null;

const externalScreenBtn = document.getElementById("externalScreenBtn");
const externalScreenInput = document.getElementById("externalScreenInput");

externalScreenBtn.addEventListener("click", () => {
  externalScreenInput.click();
});

externalScreenInput.addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (file) {
    if (externalScreenImageUrl) URL.revokeObjectURL(externalScreenImageUrl);
    externalScreenImageUrl = URL.createObjectURL(file);
    
    if (!externalWindow || externalWindow.closed) {
      externalWindow = window.open("", "ExternalScreen", "width=800,height=600");
      setupExternalWindow();
    } else {
      updateExternalWindowContent();
      externalWindow.focus();
    }
    // Clear the input so selecting the same file again triggers the event
    e.target.value = "";
  }
});

function setupExternalWindow() {
  if (!externalWindow) return;
  
  const doc = externalWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>Tarneem - External Screen</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: black; font-family: 'Cairo', sans-serif; }
        #bgMedia { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; }
        #bgVideo { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; display: none; }
        #content { 
          width: 100%; height: 92%; display: grid; place-items: center; text-align: center; 
          color: white; font-family: 'Cairo', sans-serif; font-weight: 900; 
          text-shadow: 2px 2px 5px rgba(0,0,0,0.8);
          z-index: 2; position: relative;
        }
        .line-display { font-size: 10vh; white-space: pre-wrap; max-width: 90vw; line-height: 1.4; }
        #footer {
          position: absolute; bottom: 0; left: 0; width: 100%; height: 8vh;
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 2vw; box-sizing: border-box; color: rgba(255, 255, 255, 0.5);
          font-size: 18px; z-index: 3;
        }
      </style>
    </head>
    <body>
      <img id="bgMedia" src="${externalScreenImageUrl || ''}" style="display: ${externalScreenImageUrl ? 'block' : 'none'};">
      <video id="bgVideo" loop muted playsinline></video>
      <div id="content">
        <div id="lineDisplay" class="line-display"></div>
      </div>
      <div id="footer">
        <div id="slideCounterExt"></div>
        <div></div> <!-- لضبط المسافة لو مفيش أيقونة -->
      </div>
    </body>
    </html>
  `);
  doc.close();
  
  // Wait for the window to be ready
  setTimeout(() => {
    updateExternalWindowContent();
    externalWindow.focus();
  }, 100);
}

function updateExternalWindowContent() {
  if (!externalWindow || externalWindow.closed) return;
  
  const doc = externalWindow.document;
  const lineDisplayExt = doc.getElementById("lineDisplay");
  const slideCounterExt = doc.getElementById("slideCounterExt");
  const bgMediaExt = doc.getElementById("bgMedia");
  const bgVideoExt = doc.getElementById("bgVideo");
  
  // Ensure elements exist before proceeding
  if (!lineDisplayExt || !bgMediaExt || !bgVideoExt) return;
  
  if (presentationEl.classList.contains("active")) {
    // عرض شغال - انشر محتوى المين للشاشة الخارجية
    lineDisplayExt.textContent = lineDisplay.textContent;
    lineDisplayExt.style.color = lineDisplay.style.color;
    lineDisplayExt.style.textShadow = lineDisplay.style.textShadow;
    lineDisplayExt.style.fontSize = lineDisplay.style.fontSize;
    lineDisplayExt.style.whiteSpace = lineDisplay.style.whiteSpace;
    
    // تحديث العداد في الشاشة الخارجية
    if (slideCounterExt) {
      slideCounterExt.textContent = document.getElementById("slideCounter").textContent;
    }
    
    // تطبيق الخلفية الحالية من المين
    const bgSelect = document.getElementById("bgColor").value;
    
    bgMediaExt.style.display = "none";
    bgVideoExt.style.display = "none";
    bgVideoExt.pause();

    if (bgSelect === "image" && customImageUrl) {
      bgMediaExt.src = customImageUrl;
      bgMediaExt.style.display = "block";
      doc.body.style.backgroundColor = "transparent";
    } else if (bgSelect === "video" && customVideoUrl) {
      bgVideoExt.src = customVideoUrl;
      bgVideoExt.style.display = "block";
      bgVideoExt.play().catch(e => console.log("External autoplay blocked:", e));
      doc.body.style.backgroundColor = "transparent";
    } else if (bgSelect === "white") {
      doc.body.style.backgroundColor = "#ffffff";
    } else if (bgSelect === "green") {
      doc.body.style.backgroundColor = "#00ff00";
    } else {
      doc.body.style.backgroundColor = "#000000";
    }
  } else {
    // العرض مقفول - رجع صورة الشاشة الخارجية المختارة
    lineDisplayExt.textContent = "";
    if (slideCounterExt) slideCounterExt.textContent = "";
    bgMediaExt.src = externalScreenImageUrl || "";
    bgMediaExt.style.display = externalScreenImageUrl ? "block" : "none";
    bgVideoExt.style.display = "none";
    bgVideoExt.pause();
    doc.body.style.backgroundColor = "black";
  }
}

/* البحث الفوري */

document.getElementById("searchInput").addEventListener("input", function () {
  const value = this.value.trim().toLowerCase();

  if (value.length === 0) {
    displayResults([]);
    return;
  }

  let q = normalizeArabic(value);
  
  // 1. بحث في الترانيم (بدون توسيع الاختصارات)
  const hymnMatchesMap = new Map();
  
  allHymns.forEach(song => {
    const index = song._searchText.indexOf(q);
    if (index !== -1) {
      // استخدام العنوان مع أول 50 حرف من النص لتمييز الترانيم المختلفة التي لها نفس الاسم
      const contentSample = song._searchText.substring(0, 50);
      const uniqueKey = `${song._searchTitle}_${contentSample}`;
      
      if (!hymnMatchesMap.has(uniqueKey)) {
        hymnMatchesMap.set(uniqueKey, { ...song, _matchIndex: index });
      }
    }
  });

  const hymnMatches = Array.from(hymnMatchesMap.values())
    // ترتيب النتائج: الأولوية للي بيبدأ بكلمة البحث في العنوان
    .sort((a, b) => {
      const aStarts = a._searchTitle.startsWith(q);
      const bStarts = b._searchTitle.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });

  // 2. بحث في الكتاب المقدس (مع توسيع الاختصارات)
  let expandedQ = expandAbbreviations(q);
  const bibleMatches = [];
  const bibleQueryTokens = expandedQ.split(" ").filter(Boolean);
  
  if (bibleQueryTokens.length > 0) {
    const bookSearchName = bibleQueryTokens[0];
    const chapterSearchNumber = bibleQueryTokens[1] ? parseInt(bibleQueryTokens[1]) : null;

    bible.forEach(testament => {
      testament.books.forEach(book => {
        const normalizedBookName = normalizeArabic(book.name);
        
        // إذا كان اسم الكتاب يبدأ بالكلمة الأولى في البحث
        if (normalizedBookName.startsWith(bookSearchName)) {
          if (chapterSearchNumber !== null) {
            // إذا تم تحديد رقم أصحاح
            const chapter = book.chapters.find(c => c.number === chapterSearchNumber);
            if (chapter) {
              bibleMatches.push({
                isBible: true,
                bookName: book.name,
                chapterNumber: chapter.number,
                verses: chapter.verses
              });
            }
          } else {
            // إذا لم يتم تحديد أصحاح، أظهر كل الأصحاحات المتاحة لهذا الكتاب (كأمثلة أو الكل؟)
            // لنظهر أول 5 أصحاحات مثلاً لتجنب الزحمة، أو الأصحاح الأول فقط
            book.chapters.slice(0, 5).forEach(chapter => {
              bibleMatches.push({
                isBible: true,
                bookName: book.name,
                chapterNumber: chapter.number,
                verses: chapter.verses
              });
            });
          }
        }
      });
    });
  }

  displayResults([...bibleMatches, ...hymnMatches]);
});

/* القائمة */

function toggleMenu() {
  const menu = document.getElementById("sideMenu");
  menu.classList.toggle("active");
}

/* قفل القائمة لو ضغطت بره */

document.addEventListener("click", function(e) {
  const menu = document.getElementById("sideMenu");
  const button = document.querySelector(".menu-icon");

  if (!menu.contains(e.target) && !button.contains(e.target)) {
    menu.classList.remove("active");
  }
});

/* فتح إعدادات العرض */

function toggleDisplayOptions() {
  document.getElementById("displayOptions").classList.toggle("active");
}

/* نوع العرض */

let viewMode = "single"; // 'single' or 'slides'

const singleModeBtn = document.getElementById("viewModeSingle");
const slidesModeBtn = document.getElementById("viewModeSlides");

singleModeBtn.addEventListener("click", () => {
  if (viewMode === "single") return;
  viewMode = "single";
  singleModeBtn.classList.add("selected");
  slidesModeBtn.classList.remove("selected");
  if (currentSong) openPresentation(currentSong);
  else if (currentBibleItem) openBiblePresentation(currentBibleItem);
});

slidesModeBtn.addEventListener("click", () => {
  if (viewMode === "slides") return;
  viewMode = "slides";
  slidesModeBtn.classList.add("selected");
  singleModeBtn.classList.remove("selected");
  if (currentSong) openPresentation(currentSong);
  else if (currentBibleItem) openBiblePresentation(currentBibleItem);
});

/* الخلفية */

let customImageUrl = null;
let customVideoUrl = null;

const bgImageInput = document.getElementById("bgImageInput");
const bgVideoInput = document.getElementById("bgVideoInput");
const presentationImage = document.getElementById("presentationImage");
const presentationVideo = document.getElementById("presentationVideo");
const bgColorSelect = document.getElementById("bgColor");
const cancelBgBtn = document.getElementById("cancelBgBtn");

function updateBgControls() {
  const bgSelect = bgColorSelect.value;
  if (bgSelect === "image" || bgSelect === "video") {
    cancelBgBtn.style.display = "block";
  } else {
    cancelBgBtn.style.display = "none";
  }
}

bgImageInput.addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (file) {
    if (customImageUrl) URL.revokeObjectURL(customImageUrl);
    customImageUrl = URL.createObjectURL(file);
    presentationImage.src = customImageUrl;
    bgColorSelect.value = "image";
    updateBgControls();
    updatePresentationFormatting();
  }
});

bgVideoInput.addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (file) {
    if (customVideoUrl) URL.revokeObjectURL(customVideoUrl);
    customVideoUrl = URL.createObjectURL(file);
    presentationVideo.src = customVideoUrl;
    bgColorSelect.value = "video";
    updateBgControls();
    updatePresentationFormatting();
  }
});

bgColorSelect.addEventListener("change", function () {
  document.body.classList.remove("white-bg", "black-bg", "green-bg");

  if (this.value === "black") {
    document.body.classList.add("black-bg");
  } else if (this.value === "white") {
    document.body.classList.add("white-bg");
  } else if (this.value === "green") {
    document.body.classList.add("green-bg");
  } else if (this.value === "image") {
    bgImageInput.click();
  } else if (this.value === "video") {
    bgVideoInput.click();
  }

  updateBgControls();
  updatePresentationFormatting();
});

// Also allow clicking the select itself to re-trigger the file picker 
// if the value is already 'image' or 'video'
bgColorSelect.addEventListener("click", function() {
  if (this.value === "image") {
    bgImageInput.click();
  } else if (this.value === "video") {
    bgVideoInput.click();
  }
});

cancelBgBtn.addEventListener("click", function() {
  // Clear custom media
  if (customImageUrl) {
    URL.revokeObjectURL(customImageUrl);
    customImageUrl = null;
    presentationImage.src = "";
  }
  if (customVideoUrl) {
    URL.revokeObjectURL(customVideoUrl);
    customVideoUrl = null;
    presentationVideo.src = "";
  }
  
  // Clear file inputs
  bgImageInput.value = "";
  bgVideoInput.value = "";
  
  // Switch back to green
  bgColorSelect.value = "green";
  document.body.classList.remove("white-bg", "black-bg");
  document.body.classList.add("green-bg");
  
  updateBgControls();
  updatePresentationFormatting();
});

/* ظل النص */

document.getElementById("textShadowToggle").addEventListener("change", function () {
  currentShadow = this.checked;
  // Use the search input value to refresh results if needed, or just clear
  const searchVal = document.getElementById("searchInput").value;
  if (searchVal) {
    document.getElementById("searchInput").dispatchEvent(new Event('input'));
  }
  updatePresentationFormatting();
});

/* لون الخط */

const fontColorInput = document.getElementById("fontColor");
const preview = document.getElementById("colorPreview");

if (fontColorInput && preview) {

  // خلي اللون الافتراضي أبيض
  currentFontColor = "#ffffff";
  fontColorInput.value = "#ffffff";
  preview.style.background = "#ffffff";

  fontColorInput.addEventListener("input", function () {
    const color = this.value;

    currentFontColor = color;
    preview.style.background = color;

    updatePresentationFormatting();
  });
}

let currentSong = null;
let currentBibleItem = null;
let currentLines = [];
let activeIndex = 0;
let numberBuffer = "";
let numberBufferTimer = null;

const presentationEl = document.getElementById("presentation");
const hymnContainer = document.getElementById("hymnContainer");
const lineDisplay = document.getElementById("lineDisplay");
const presentationTitle = document.getElementById("presentationTitle");

function getSongLines(song) {
  const lines = [];
  const chorus = Array.isArray(song.chorus) ? song.chorus : [];
  const verses = Array.isArray(song.verses) ? song.verses : [];
  if (song.chorusFirst && chorus.length) {
    chorus.forEach(l => {
      l.split(/\r?\n/).forEach(t => { const s = t.trim(); if (s) lines.push(s); });
    });
  }
  verses.forEach(v => {
    if (Array.isArray(v)) {
      v.forEach(l => {
        l.split(/\r?\n/).forEach(t => { const s = t.trim(); if (s) lines.push(s); });
      });
    } else if (typeof v === "string") {
      v.split(/\r?\n/).forEach(t => { const s = t.trim(); if (s) lines.push(s); });
    }
    if (chorus.length) {
      chorus.forEach(l => {
        l.split(/\r?\n/).forEach(t => { const s = t.trim(); if (s) lines.push(s); });
      });
    }
  });
  if (!verses.length && chorus.length) {
    chorus.forEach(l => {
      l.split(/\r?\n/).forEach(t => { const s = t.trim(); if (s) lines.push(s); });
    });
  }
  return lines;
}

function normalizeArabic(str) {
  return str
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[آأإا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const ABBR = (() => {
  const map = {
    "مز": "مزمور",
    "مر": "مرقس",
    "مت": "متى",
    "لو": "لوقا",
    "يو": "يوحنا",
    "اع": "اعمال",
    "رو": "رومية",
    "غل": "غلاطية",
    "اف": "افسس",
    "في": "فيلبي",
    "كو": "كورنثوس",
    "يع": "يعقوب",
    "بط": "بطرس",
    "رؤ": "رؤيا"
  };
  const out = {};
  for (const [k,v] of Object.entries(map)) {
    out[normalizeArabic(k)] = normalizeArabic(v);
  }
  // numeric variants
  out["1كو"] = normalizeArabic("1 كورنثوس");
  out["2كو"] = normalizeArabic("2 كورنثوس");
  out["1يو"] = normalizeArabic("1 يوحنا");
  out["2يو"] = normalizeArabic("2 يوحنا");
  out["3يو"] = normalizeArabic("3 يوحنا");
  out["1بط"] = normalizeArabic("1 بطرس");
  out["2بط"] = normalizeArabic("2 بطرس");
  return out;
})();

function expandAbbreviations(q) {
  const tokens = q.split(" ").filter(Boolean);
  const expanded = tokens.map(tok => {
    // direct match
    if (ABBR[tok]) return ABBR[tok];
    // prefix with digits e.g., "مز23" -> "مزمور 23"
    const m = tok.match(/^([^\d]+)(\d[\d:]*)$/);
    if (m && ABBR[m[1]]) {
      return ABBR[m[1]] + " " + m[2].replace(/:/g, " ");
    }
    return tok;
  });
  return expanded.join(" ").trim();
}

function prepareSearchFields(song) {
  const title = (song.title || song.name || "").trim();
  let text = title + " ";
  const chorus = Array.isArray(song.chorus) ? song.chorus : [];
  const verses = Array.isArray(song.verses) ? song.verses : [];
  chorus.forEach(c => { text += " " + c; });
  verses.forEach(v => {
    if (Array.isArray(v)) {
      v.forEach(l => { text += " " + l; });
    } else {
      text += " " + v;
    }
  });
  return {
    ...song,
    title: title,
    _searchTitle: normalizeArabic(title),
    _searchText: normalizeArabic(text)
  };
}

function openBiblePresentation(bibleItem) {
  currentBibleItem = bibleItem;
  currentSong = null;
  const slides = [];

  function splitToFourWords(text) {
    if (!text) return [];
    const cleanText = text.replace(/\s+/g, " ").trim();
    const words = cleanText.split(" ").filter(Boolean);
    const result = [];
    for (let i = 0; i < words.length; i += 4) {
      result.push(words.slice(i, i + 4).join(" "));
    }
    return result;
  }

  if (viewMode === "slides") {
    bibleItem.verses.forEach(v => {
      slides.push(`(${v.number}) ${v.text}`);
    });
  } else {
    bibleItem.verses.forEach(v => {
      const verseText = `(${v.number}) ${v.text}`;
      const chunks = splitToFourWords(verseText);
      chunks.forEach(c => slides.push(c));
    });
  }

  currentLines = slides;
  activeIndex = 0;

  presentationTitle.textContent = `${bibleItem.bookName} ${bibleItem.chapterNumber}`;
  presentationEl.classList.add("active");
  setActive(activeIndex);

  _saveToHistory(bibleItem);
}

function openPresentation(song) {
  currentSong = song;
  currentBibleItem = null;
  const slides = [];

  function splitToFourWords(text) {
    if (!text) return [];
    const cleanText = text.replace(/\s+/g, " ").trim();
    const words = cleanText.split(" ").filter(Boolean);
    const result = [];
    for (let i = 0; i < words.length; i += 4) {
      result.push(words.slice(i, i + 4).join(" "));
    }
    return result;
  }

  function formatSixWordsPerLine(text) {
    if (!text) return "";
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lines = [];
    for (let i = 0; i < words.length; i += 6) {
      lines.push(words.slice(i, i + 6).join(" "));
    }
    return lines.join("\n");
  }

  function addSection(section) {
    if (!section) return;
    let lines = [];
    if (Array.isArray(section)) {
      section.forEach(line => {
        if (typeof line === "string") {
          line.split(/\r?\n/).forEach(l => {
            const trimmed = l.trim();
            if (trimmed) lines.push(trimmed);
          });
        }
      });
    } else if (typeof section === "string") {
      section.split(/\r?\n/).forEach(l => {
        const trimmed = l.trim();
        if (trimmed) lines.push(trimmed);
      });
    }

    if (lines.length === 0) return;

    if (viewMode === "slides") {
      const fullText = lines.join(" ");
      slides.push(formatSixWordsPerLine(fullText));
    } else {
      lines.forEach(line => {
        const chunks = splitToFourWords(line);
        chunks.forEach(c => slides.push(c));
      });
    }
  }

  const chorus = Array.isArray(song.chorus) ? song.chorus : [];
  const verses = Array.isArray(song.verses) ? song.verses : [];

  if (song.chorusFirst && chorus.length) {
    chorus.forEach(c => addSection(c));
  }

  verses.forEach(v => {
    addSection(v);
    if (chorus.length) {
      chorus.forEach(c => addSection(c));
    }
  });

  if (!verses.length && !song.chorusFirst && chorus.length) {
    chorus.forEach(c => addSection(c));
  }

  currentLines = slides;
  activeIndex = 0;

  const searchInput = document.getElementById("searchInput");
  if (searchInput && searchInput.value.trim()) {
    const q = normalizeArabic(searchInput.value.trim());
    const foundIndex = currentLines.findIndex(l => normalizeArabic(l).includes(q));
    if (foundIndex !== -1) {
      activeIndex = foundIndex;
    }
  }

  presentationTitle.textContent = song.title || song.name || "";
  presentationEl.classList.add("active");
  setActive(activeIndex);

  _saveToHistory(song);
}

function closePresentation() {
  console.log("إغلاق العرض ومسح البحث...");
  presentationEl.classList.remove("active");
  currentSong = null;
  currentBibleItem = null;
  currentLines = [];
  activeIndex = 0;
  
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      searchInput.value = "";
      const container = document.getElementById("songsContainer");
      if (container) container.innerHTML = "";
    }, 10);
  }

  updatePresentationFormatting();
}

function setActive(idx) {
  activeIndex = Math.max(0, Math.min(currentLines.length - 1, idx));
  lineDisplay.textContent = currentLines[activeIndex] || "";
  
  const counterEl = document.getElementById("slideCounter");
  if (counterEl && currentLines.length > 0) {
    counterEl.textContent = `${currentLines.length} / ${activeIndex + 1}`;
  } else if (counterEl) {
    counterEl.textContent = "";
  }

  updatePresentationFormatting();

  if (!currentSong && !currentBibleItem && _customAlign) {
    lineDisplay.style.textAlign = _customAlign;
  }
}

function nextLine() {
  setActive(activeIndex + 1);
}

function prevLine() {
  setActive(activeIndex - 1);
}

function scrollActiveIntoView() {}

function updatePresentationFormatting() {
  const isActive = presentationEl.classList.contains("active");
  const bgSelect = document.getElementById("bgColor").value;

  if (bgSelect === "image" || bgSelect === "video") {
    cancelBgBtn.style.display = "block";
  } else {
    cancelBgBtn.style.display = "none";
  }

  if (isActive) {
    presentationImage.style.display = "none";
    presentationVideo.style.display = "none";
    presentationVideo.pause();

    if (bgSelect === "black") {
      presentationEl.style.backgroundColor = "#000000";
    } else if (bgSelect === "white") {
      presentationEl.style.backgroundColor = "#ffffff";
    } else if (bgSelect === "green") {
      presentationEl.style.backgroundColor = "#00ff00";
    } else if (bgSelect === "image" && customImageUrl) {
      presentationImage.style.display = "block";
      presentationEl.style.backgroundColor = "transparent";
    } else if (bgSelect === "video" && customVideoUrl) {
      presentationVideo.style.display = "block";
      presentationVideo.play().catch(e => console.log("Autoplay blocked:", e));
      presentationEl.style.backgroundColor = "transparent";
    }

    lineDisplay.style.color = currentFontColor;
    lineDisplay.style.textShadow = currentShadow ? "2px 2px 5px rgba(0,0,0,0.8)" : "none";

    if (viewMode === "single") {
      lineDisplay.style.fontSize = "10vh";
      lineDisplay.style.whiteSpace = "pre-wrap"; 
      lineDisplay.style.lineHeight = "1.4";
    } else {
      lineDisplay.style.fontSize = "10vh";
      lineDisplay.style.whiteSpace = "pre-wrap";
      lineDisplay.style.lineHeight = "1.4";
    }
  }

  updateExternalWindowContent();
}

window.addEventListener("keydown", function (e) {
  if (!presentationEl.classList.contains("active")) return;
  if (/^[0-9]$/.test(e.key)) {
    numberBuffer += e.key;
    if (numberBufferTimer) clearTimeout(numberBufferTimer);
    numberBufferTimer = setTimeout(() => { numberBuffer = ""; }, 3000);
    return;
  }
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    nextLine();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    prevLine();
  } else if (e.key === "Enter") {
    if (numberBuffer.length) {
      const n = parseInt(numberBuffer, 10);
      numberBuffer = "";
      if (!isNaN(n)) {
        setActive(n - 1);
      }
    } else {
      nextLine();
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    closePresentation();
  }
});

/* ================================================================
   قائمة المحفوظات
   ================================================================ */

let _historyList = [];
try { _historyList = JSON.parse(localStorage.getItem("tarneemHistory") || "[]"); } catch(e) { _historyList = []; }

function _saveToHistory(item) {
  const key = item.isBible
    ? "bible_" + item.bookName + "_" + item.chapterNumber
    : "hymn_" + (item.title || item.name || "");

  _historyList = _historyList.filter(h => h._historyKey !== key);
  _historyList.unshift(Object.assign({}, item, { _historyKey: key, _historyTime: Date.now() }));
  if (_historyList.length > 50) _historyList = _historyList.slice(0, 50);

  try { localStorage.setItem("tarneemHistory", JSON.stringify(_historyList)); } catch(e) {}
  _renderHistoryList();
}

function _removeFromHistory(key) {
  _historyList = _historyList.filter(h => h._historyKey !== key);
  try { localStorage.setItem("tarneemHistory", JSON.stringify(_historyList)); } catch(e) {}
  _renderHistoryList();
}

function _clearHistory() {
  _historyList = [];
  try { localStorage.setItem("tarneemHistory", "[]"); } catch(e) {}
  _renderHistoryList();
}

function _openCustomTextFromHistory(item) {
  currentSong = null;
  currentBibleItem = null;
  currentLines = [item._customText];
  activeIndex = 0;
  _customAlign = item._customAlign || "center";
  presentationTitle.textContent = "نص مخصص";
  presentationEl.classList.add("active");
  setActive(0);
  lineDisplay.style.textAlign = _customAlign;
}

function _renderHistoryList() {
  const c = document.getElementById("_historyContainer");
  if (!c) return;
  c.innerHTML = "";
  if (_historyList.length === 0) {
    c.innerHTML = '<div style="color:#888;padding:10px;text-align:center;font-size:13px;">لا يوجد محفوظات بعد</div>';
    return;
  }
  _historyList.forEach(function(item) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;border-bottom:1px solid #f0f0f0;";

    const label = document.createElement("div");
    label.className = "song";
    label.style.cssText = "color:#000;text-shadow:none;flex:1;border-bottom:none;margin:0;cursor:pointer;";

    if (item._isCustomText) {
      const preview = item._customText.length > 40
        ? item._customText.substring(0, 40) + "..."
        : item._customText;
      label.textContent = "نص: " + preview;
      label.addEventListener("click", function() { _openCustomTextFromHistory(item); });
    } else if (item.isBible) {
      label.textContent = item.bookName + " " + item.chapterNumber;
      label.addEventListener("click", function() { openBiblePresentation(item); });
    } else {
      label.textContent = item.title || item.name || "ترنيمة";
      label.addEventListener("click", function() { openPresentation(item); });
    }

    const delBtn = document.createElement("button");
    delBtn.textContent = "×";
    delBtn.title = "حذف";
    delBtn.style.cssText = "background:none;border:none;color:#bbb;font-size:20px;cursor:pointer;padding:0 10px;line-height:1;flex-shrink:0;font-weight:bold;";
    delBtn.addEventListener("mouseover", function() { this.style.color = "#e74c3c"; });
    delBtn.addEventListener("mouseout",  function() { this.style.color = "#bbb"; });
    delBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      _removeFromHistory(item._historyKey);
    });

    row.appendChild(label);
    row.appendChild(delBtn);
    c.appendChild(row);
  });
}

/* ================================================================
   النص المخصص
   ================================================================ */

var _customAlign = "center";

function _openCustomModal() {
  document.getElementById("_customModal").style.display = "flex";
  document.getElementById("_customTextArea").focus();
}

function _closeCustomModal() {
  document.getElementById("_customModal").style.display = "none";
}

function _setAlign(val) {
  _customAlign = val;
  ["_btnRight", "_btnCenter", "_btnLeft"].forEach(function(id) {
    document.getElementById(id).style.background = "#fff";
    document.getElementById(id).style.color = "#1b3c59";
  });
  const map = { right: "_btnRight", center: "_btnCenter", left: "_btnLeft" };
  document.getElementById(map[val]).style.background = "#1b3c59";
  document.getElementById(map[val]).style.color = "#fff";
}

function _saveCustomText() {
  const text = document.getElementById("_customTextArea").value;
  if (!text.trim()) return;

  const ts = Date.now();
  const customItem = {
    _isCustomText: true,
    _customText: text.trim(),
    _customAlign: _customAlign,
    _historyTime: ts,
    _historyKey: "custom_" + ts
  };

  _historyList.unshift(customItem);
  if (_historyList.length > 50) _historyList = _historyList.slice(0, 50);
  try { localStorage.setItem("tarneemHistory", JSON.stringify(_historyList)); } catch(e) {}
  _renderHistoryList();

  document.getElementById("_customTextArea").value = "";
  _closeCustomModal();
}

/* ================================================================
   حقن عناصر HTML للإضافات تلقائياً
   ================================================================ */

(function _injectAdditionsHTML() {

  const style = document.createElement("style");
  style.textContent = `
    ._hbox { margin: 12px 16px 80px; border: 1px solid #ddd; border-radius: 10px; overflow: hidden; }
    ._hhdr {
      background: #1b3c59; color: #fff; padding: 10px 14px;
      font-family: 'Cairo', sans-serif; font-size: 15px; font-weight: 700;
      display: flex; justify-content: space-between; align-items: center;
    }
    ._hhdr button {
      background: none; border: none; color: rgba(255,255,255,0.6);
      font-size: 22px; cursor: pointer; padding: 0; line-height: 1; font-weight: bold;
    }
    ._hhdr button:hover { color: #fff; }
    #_historyContainer { max-height: 300px; overflow-y: auto; }
    #_fabBtn {
      position: fixed; bottom: 28px; left: 28px; width: 52px; height: 52px;
      border-radius: 50%; background: #1b3c59; color: #fff; font-size: 32px;
      border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.35);
      z-index: 999; display: flex; align-items: center; justify-content: center;
      font-family: 'Cairo', sans-serif; line-height: 1;
    }
    #_fabBtn:hover { background: #27527a; }
    #_customModal {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,.55); z-index: 1100;
      align-items: center; justify-content: center;
    }
    ._mbox {
      background: #fff; border-radius: 14px; padding: 22px 18px 18px;
      width: min(92vw, 420px); display: flex; flex-direction: column; gap: 12px;
      font-family: 'Cairo', sans-serif;
    }
    ._mbox h3 { margin: 0; font-size: 17px; color: #1b3c59; text-align: center; }
    #_customTextArea {
      width: 100%; min-height: 130px; border: 1.5px solid #ccc; border-radius: 8px;
      padding: 10px; font-family: 'Cairo', sans-serif; font-size: 15px;
      resize: vertical; box-sizing: border-box; direction: rtl;
    }
    ._arow { display: flex; gap: 8px; align-items: center; }
    ._arow span { font-size: 13px; color: #555; }
    ._ab {
      border: 1.5px solid #1b3c59; border-radius: 6px; padding: 5px 14px;
      cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 13px;
      background: #fff; color: #1b3c59;
    }
    ._mac { display: flex; gap: 10px; justify-content: flex-end; }
    ._mac button { font-family: 'Cairo', sans-serif; font-size: 14px; padding: 8px 22px; border-radius: 8px; border: none; cursor: pointer; }
    ._bsave { background: #1b3c59; color: #fff; }
    ._bcanc { background: #eee; color: #333; }
  `;
  document.head.appendChild(style);

  // قسم المحفوظات
  const hbox = document.createElement("div");
  hbox.className = "_hbox";
  hbox.innerHTML = `
    <div class="_hhdr">
      <span>المحفوظات</span>
      <button onclick="_clearHistory()" title="مسح الكل">×</button>
    </div>
    <div id="_historyContainer"></div>
  `;
  const mainEl = document.querySelector("main");
  if (mainEl) mainEl.appendChild(hbox);

  // زر +
  const fab = document.createElement("button");
  fab.id = "_fabBtn";
  fab.textContent = "+";
  fab.title = "إضافة نص مخصص";
  fab.addEventListener("click", _openCustomModal);
  document.body.appendChild(fab);

  // المودال
  const modal = document.createElement("div");
  modal.id = "_customModal";
  modal.innerHTML = `
    <div class="_mbox">
      <h3>إضافة نص مخصص</h3>
      <textarea id="_customTextArea" placeholder="اكتب النص هنا..."></textarea>
      <div class="_arow">
        <span>محاذاة:</span>
        <button id="_btnRight"  class="_ab" onclick="_setAlign('right')">يمين</button>
        <button id="_btnCenter" class="_ab" onclick="_setAlign('center')" style="background:#1b3c59;color:#fff;">وسط</button>
        <button id="_btnLeft"   class="_ab" onclick="_setAlign('left')">شمال</button>
      </div>
      <div class="_mac">
        <button class="_bcanc" onclick="_closeCustomModal()">إلغاء</button>
        <button class="_bsave" onclick="_saveCustomText()">حفظ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  _renderHistoryList();
})();
