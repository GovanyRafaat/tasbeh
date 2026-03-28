let songs = [];
let bible = [];
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
    const responseSongs = await fetch("tasbe7naDB.json");
    songs = await responseSongs.json();
    songs = songs.map(s => prepareSearchFields(s));
    
    const responseBible = await fetch("bible.json");
    bible = await responseBible.json();
    
    displayResults([]);
    updateBgControls();
  } catch (error) {
    console.log("فشل تحميل البيانات", error);
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
      <title>New Song - External Screen</title>
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: black; }
        #bgMedia { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; }
        #bgVideo { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; display: none; }
        #content { 
          width: 100%; height: 100%; display: grid; place-items: center; text-align: center; 
          color: white; font-family: Arial; font-weight: bold; 
          text-shadow: 2px 2px 5px rgba(0,0,0,0.8);
          z-index: 2; position: relative;
        }
        .line-display { font-size: 12vh; white-space: pre-wrap; max-width: 90vw; }
      </style>
    </head>
    <body>
      <img id="bgMedia" src="${externalScreenImageUrl || ''}" style="display: ${externalScreenImageUrl ? 'block' : 'none'};">
      <video id="bgVideo" loop muted playsinline></video>
      <div id="content">
        <div id="lineDisplay" class="line-display"></div>
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
  const bgMediaExt = doc.getElementById("bgMedia");
  const bgVideoExt = doc.getElementById("bgVideo");
  
  if (presentationEl.classList.contains("active")) {
    // عرض شغال
    lineDisplayExt.textContent = lineDisplay.textContent;
    lineDisplayExt.style.color = lineDisplay.style.color;
    lineDisplayExt.style.textShadow = lineDisplay.style.textShadow;
    lineDisplayExt.style.fontSize = lineDisplay.style.fontSize;
    
    // تطبيق الخلفية الحالية من المين
    const bgSelect = document.getElementById("bgColor").value;
    const mainBg = presentationEl.style.backgroundColor;
    
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
    } else {
      doc.body.style.backgroundColor = mainBg || "black";
    }
  } else {
    // العرض مقفول - رجع صورة الشاشة الخارجية
    lineDisplayExt.textContent = "";
    bgMediaExt.src = externalScreenImageUrl;
    bgMediaExt.style.display = "block";
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
  let expandedQ = expandAbbreviations(q);
  
  // 1. بحث في الترانيم
  const hymnMatches = songs
    .map(song => {
      const index = song._searchText.indexOf(expandedQ);
      if (index !== -1) {
        return { ...song, _matchIndex: index };
      }
      return null;
    })
    .filter(Boolean);

  // 2. بحث في الكتاب المقدس (كتب وأصحاحات)
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

  // ✅ خلي اللون الافتراضي أبيض
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
    .replace(/[ًٌٍَُِّْـ]/g, "")
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
  const title = song.title || song.name || "";
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
    _searchTitle: normalizeArabic(title),
    _searchText: normalizeArabic(text)
  };
}
function openBiblePresentation(bibleItem) {
  currentBibleItem = bibleItem;
  currentSong = null; // حتى لا تتعارض مع الترانيم
  const slides = [];

  // دالة مساعدة لتقسيم النص لـ 4 كلمات
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

  // إذا كان نوع العرض "شرائح"، تظهر كل آية في شريحة مستقلة
  if (viewMode === "slides") {
    bibleItem.verses.forEach(v => {
      slides.push(`(${v.number}) ${v.text}`);
    });
  } else {
    // وضع "سطر واحد" = 4 كلمات لكل شريحة
    bibleItem.verses.forEach(v => {
      const verseText = `(${v.number}) ${v.text}`;
      const chunks = splitToFourWords(verseText);
      chunks.forEach(c => slides.push(c));
    });
  }

  currentLines = slides;
  activeIndex = 0;

  presentationTitle.textContent = `${bibleItem.bookName} ${bibleItem.chapterNumber}`;
  lineDisplay.textContent = currentLines[activeIndex] || "";
  presentationEl.classList.add("active");
  updatePresentationFormatting();
}

function openPresentation(song) {
  currentSong = song;
  currentBibleItem = null; // حتى لا تتعارض مع الكتاب المقدس
  const slides = [];

  // Helper to split text into EXACTLY 4 words per chunk
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

  // Helper to format text with 6 words per line
  function formatSixWordsPerLine(text) {
    if (!text) return "";
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lines = [];
    for (let i = 0; i < words.length; i += 6) {
      lines.push(words.slice(i, i + 6).join(" "));
    }
    return lines.join("\n");
  }

  // Helper to add a section (verse or chorus)
  function addSection(section) {
    if (!section) return;
    let text = "";
    if (Array.isArray(section)) {
      text = section.join(" ");
    } else {
      text = section;
    }

    if (!text.trim()) return;

    if (viewMode === "slides") {
      // Slides mode: One bracket (section) = One slide
      // Apply 6-word per line formatting
      slides.push(formatSixWordsPerLine(text));
    } else {
      // Single Line mode: Exactly 4 words per slide
      const chunks = splitToFourWords(text);
      chunks.forEach(c => slides.push(c));
    }
  }

  const chorus = Array.isArray(song.chorus) ? song.chorus : [];
  const verses = Array.isArray(song.verses) ? song.verses : [];

  // Presentation order
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

  // Search matching to start at the right slide
  const searchInput = document.getElementById("searchInput");
  if (searchInput && searchInput.value.trim()) {
    const q = normalizeArabic(searchInput.value.trim());
    const foundIndex = currentLines.findIndex(l => normalizeArabic(l).includes(q));
    if (foundIndex !== -1) {
      activeIndex = foundIndex;
    }
  }

  presentationTitle.textContent = song.title || song.name || "";
  lineDisplay.textContent = currentLines[activeIndex] || "";
  presentationEl.classList.add("active");
  updatePresentationFormatting();
}

function closePresentation() {
  presentationEl.classList.remove("active");
  currentSong = null;
  currentBibleItem = null;
  currentLines = [];
  activeIndex = 0;
  
  updatePresentationFormatting();
}

function setActive(idx) {
  activeIndex = Math.max(0, Math.min(currentLines.length - 1, idx));
  lineDisplay.textContent = currentLines[activeIndex] || "";
  updatePresentationFormatting();
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

  // Show/Hide Cancel button based on background type (always check)
  if (bgSelect === "image" || bgSelect === "video") {
    cancelBgBtn.style.display = "block";
  } else {
    cancelBgBtn.style.display = "none";
  }

  // Only update the main presentation overlay if it's active
  if (isActive) {
    // Reset media visibility
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

    // لون الخط
    lineDisplay.style.color = currentFontColor;

    // ظل النص
    lineDisplay.style.textShadow = currentShadow ? "2px 2px 5px rgba(0,0,0,0.8)" : "none";

    // نوع العرض (تعديل الحجم والمسافات)
    if (viewMode === "single") {
      lineDisplay.style.fontSize = "15vh";
      lineDisplay.style.whiteSpace = "pre-wrap"; 
    } else {
      lineDisplay.style.fontSize = "12vh";
      lineDisplay.style.whiteSpace = "pre-wrap";
    }
  }

  // Always update the external window if it exists
  updateExternalWindowContent();
}

function updateExternalWindowContent() {
  if (!externalWindow || externalWindow.closed) return;
  
  const doc = externalWindow.document;
  const lineDisplayExt = doc.getElementById("lineDisplay");
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
    bgMediaExt.src = externalScreenImageUrl || "";
    bgMediaExt.style.display = externalScreenImageUrl ? "block" : "none";
    bgVideoExt.style.display = "none";
    bgVideoExt.pause();
    doc.body.style.backgroundColor = "black";
  }
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
        // 1-based slide numbering
        setActive(n - 1);
      }
    } else {
      nextLine();
    }
  } else if (e.key === "Escape") {
    closePresentation();
  }
});
