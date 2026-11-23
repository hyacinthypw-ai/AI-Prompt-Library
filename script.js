/**
 * ============================================================
 * 設定區：串接你的 Google Sheets 與 Google Form
 * ============================================================
 * 1. 在 Google Sheets 點選「檔案 > 共用 > 發布到網路」，選擇「逗號分隔值 (.csv)」，將取得的網址貼入下方 GOOGLE_SHEET_CSV_URL。
 * 2. 若留空 ""，網頁會自動載入下方的 DEMO_DATA 預設範例資料供預覽測試。
 * 3. 試算表第一列欄位順序建議：date, title, tip, prompt, image, tags, model, link
 */
const CONFIG = {
  GOOGLE_SHEET_CSV_URL: "", // 貼上發布到網路的 CSV 連結
  GOOGLE_FORM_URL: "#"      // 貼上你的 Google 試算表或表單連結
};

const FAVORITES_STORAGE_KEY = "ai_prompt_library_favorites_v1";
const FAV_FILTER_TAG = "★ 已收藏";

// 預設測試資料（當尚未填入 CSV 網址時自動顯示）
const DEMO_DATA = [
  {
    id: "demo-1",
    favKey: "demo-1",
    date: "2026-11-23",
    title: "自然晨光玻璃瓶商業靜物攝影",
    tip: "利用 diffused morning sunlight 搭配 subtle film grain，能消除 AI 常見的塑膠過度平滑感，呈現溫潤真實的商業攝影質地。",
    prompt: "Minimalist amber glass dropper bottle resting on raw travertine stone, surrounded by dried white botanicals, soft diffused morning window light casting gentle long shadows, warm neutral palette, macro lens 85mm f/2.8, 8K editorial product photography, Kodak Portra 400 subtle film grain --ar 4:5 --stylize 150",
    image: "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=800&q=80",
    tags: ["商業攝影", "光影控制", "極簡靜物"],
    model: "Midjourney v6.1 / Nano Banana Pro",
    link: "https://www.reddit.com/r/midjourney/"
  },
  {
    id: "demo-2",
    favKey: "demo-2",
    date: "2026-11-23",
    title: "19世紀復古植物學銅版畫蝕刻線稿",
    tip: "指定 stippling shading（點刻陰影）與 isolated on pure white background，後續在設計軟體去背排版最乾淨。",
    prompt: "Vintage 19th-century scientific botanical engraving illustration of blooming osmanthus branch with delicate leaves, fine black ink etching line art, intricate cross-hatching and stippling shading, high contrast, isolated on pure white background, clean vector-like precision --no color, photo, realistic shading --ar 3:4",
    image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80",
    tags: ["插畫線稿", "包裝素材", "復古雕版"],
    model: "Midjourney / Flux",
    link: "#"
  },
  {
    id: "demo-3",
    favKey: "demo-3",
    date: "2026-11-22",
    title: "日系空氣感木質桌面與手作器皿場景",
    tip: "加入 overhead flatlay 與 negative space for typography，可直接預留海報或 Banner 壓字空間。",
    prompt: "Japanese airy craft lifestyle photography, overhead flatlay on warm weathered oak table, handmade ceramic cup, linen cloth texture, soft overcast natural daylight, generous negative space on upper right for typography, 50mm lens, organic calm mood, ultra-detailed texture, 8K --ar 16:9",
    image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
    tags: ["商業攝影", "版面留白", "日系極簡"],
    model: "Google Flow / Imagen",
    link: "#"
  },
  {
    id: "demo-4",
    favKey: "demo-4",
    date: "2026-11-21",
    title: "微縮溫馨節慶櫥窗景深控制技巧",
    tip: "使用 tilt-shift lens 搭配 warm bokeh fairy lights，能製造精緻的手工微縮模型立體景深。",
    prompt: "Miniature winter artisan workshop diorama inside a warm wooden display box, tiny glass jars, dried orange slices and pine cones, glowing warm tungsten fairy lights in background creating creamy bokeh, tilt-shift macro 100mm f/2.0, cinematic warm color grading, rich tactile textures --ar 1:1",
    image: "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=800&q=80",
    tags: ["微縮場景", "光影控制", "節慶視覺"],
    model: "Midjourney v6.1",
    link: "#"
  }
];

// 狀態管理
let allItems = [];
let activeTag = "全部";
let searchQuery = "";
let favoriteSet = loadFavorites();

// DOM 元素
const galleryGrid = document.getElementById("galleryGrid");
const tagContainer = document.getElementById("tagContainer");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const statsCount = document.getElementById("statsCount");
const addFormLink = document.getElementById("addFormLink");
const toastEl = document.getElementById("toast");

// 初始化
document.addEventListener("DOMContentLoaded", async () => {
  addFormLink.href = CONFIG.GOOGLE_FORM_URL;
  bindEvents();
  await loadData();
});

// 讀取與儲存瀏覽器收藏紀錄 (localStorage)
function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favoriteSet)));
  } catch (e) {
    console.warn("無法寫入 localStorage：", e);
  }
}

// 產生穩定的收藏識別碼（即使試算表新增列數也不會跑位）
function buildFavKey(link, title, prompt) {
  if (link && link !== "#") return `link:${link}`;
  return `item:${title}|${String(prompt).slice(0, 60)}`;
}

// 綁定搜尋、重設、收藏與複製事件
function bindEvents() {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    clearSearchBtn.hidden = searchQuery.length === 0;
    renderGallery();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    clearSearchBtn.hidden = true;
    searchInput.focus();
    renderGallery();
  });

  resetFilterBtn.addEventListener("click", () => {
    activeTag = "全部";
    searchInput.value = "";
    searchQuery = "";
    clearSearchBtn.hidden = true;
    renderTags();
    renderGallery();
  });

  // 事件委派：處理卡片內的「★ 收藏按鈕」、「複製按鈕」與「底部小標籤點擊」
  galleryGrid.addEventListener("click", (e) => {
    // 1. 點擊右上角星星收藏按鈕
    const favBtn = e.target.closest(".fav-btn");
    if (favBtn) {
      const favKey = favBtn.dataset.favkey;
      toggleFavorite(favKey, favBtn);
      return;
    }

    // 2. 點擊複製指令按鈕
    const copyBtn = e.target.closest(".copy-btn");
    if (copyBtn) {
      const itemId = copyBtn.dataset.id;
      const targetItem = allItems.find((item) => item.id === itemId);
      if (targetItem) {
        copyToClipboard(targetItem.prompt, copyBtn);
      }
      return;
    }

    // 3. 點擊卡片底部小標籤
    const miniTag = e.target.closest(".mini-tag");
    if (miniTag) {
      activeTag = miniTag.dataset.tag;
      renderTags();
      renderGallery();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

// 切換收藏狀態
function toggleFavorite(favKey, btnElement) {
  const cardEl = btnElement.closest(".prompt-card");
  const isNowFav = !favoriteSet.has(favKey);

  if (isNowFav) {
    favoriteSet.add(favKey);
    btnElement.classList.add("active");
    btnElement.textContent = "★";
    btnElement.title = "取消收藏";
    btnElement.setAttribute("aria-pressed", "true");
    if (cardEl) cardEl.classList.add("is-favorited");
    showToast("★ 已加入最愛收藏");
  } else {
    favoriteSet.delete(favKey);
    btnElement.classList.remove("active");
    btnElement.textContent = "☆";
    btnElement.title = "加入收藏最愛";
    btnElement.setAttribute("aria-pressed", "false");
    if (cardEl) cardEl.classList.remove("is-favorited");
    showToast("已從收藏移除");

    // 若目前正處於「★ 已收藏」篩選檢視，取消收藏時即時刷新畫面
    if (activeTag === FAV_FILTER_TAG) {
      renderGallery();
    }
  }

  saveFavorites();
  renderTags(); // 即時更新上方「★ 已收藏 (數量)」計數
}

// 讀取資料（支援 Google Sheets CSV 或本地預設資料）
async function loadData() {
  loadingState.hidden = false;

  if (!CONFIG.GOOGLE_SHEET_CSV_URL) {
    allItems = DEMO_DATA;
    loadingState.hidden = true;
    renderTags();
    renderGallery();
    return;
  }

  try {
    const response = await fetch(CONFIG.GOOGLE_SHEET_CSV_URL);
    if (!response.ok) throw new Error("網路回應異常");
    const csvText = await response.text();
    allItems = parseCSVToItems(csvText);
  } catch (error) {
    console.error("讀取 Google Sheets 失敗，改為載入預設資料：", error);
    allItems = DEMO_DATA;
  } finally {
    loadingState.hidden = true;
    renderTags();
    renderGallery();
  }
}

// 穩健的 CSV 解析器（支援欄位內含逗號、引號與換行的長篇 Prompt）
function parseCSVToItems(csvText) {
  const rows = [];
  let currentRow = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentVal.trim());
        currentVal = "";
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        if (char === "\r") i++;
        currentRow.push(currentVal.trim());
        if (currentRow.some((cell) => cell !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
  }
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((cell) => cell !== "")) rows.push(currentRow);
  }

  const dataRows = rows.slice(1);
  return dataRows
    .map((cols, index) => {
      const title = cols[1] || "未命名生圖靈感";
      const prompt = cols[3] || "";
      const link = cols[7] || "#";
      return {
        id: `item-${index}`,
        favKey: buildFavKey(link, title, prompt),
        date: cols[0] || "",
        title: title,
        tip: cols[2] || "",
        prompt: prompt,
        image: cols[4] || "",
        tags: (cols[5] || "未分類")
          .split(/[,、，]/)
          .map((t) => t.trim())
          .filter(Boolean),
        model: cols[6] || "AI Image",
        link: link
      };
    })
    .reverse();
}

// 動態產生分類標籤列（含「★ 已收藏」專屬篩選鈕）
function renderTags() {
  const favCount = allItems.filter((item) => favoriteSet.has(item.favKey)).length;
  const normalTags = new Set();
  allItems.forEach((item) => {
    item.tags.forEach((tag) => normalTags.add(tag));
  });

  let buttonsHTML = `
    <button class="tag-btn ${activeTag === "全部" ? "active" : ""}" data-tag="全部">
      #全部
    </button>
    <button class="tag-btn fav-filter-btn ${activeTag === FAV_FILTER_TAG ? "active" : ""}" data-tag="${FAV_FILTER_TAG}">
      ★ 已收藏 (${favCount})
    </button>
  `;

  buttonsHTML += Array.from(normalTags)
    .map(
      (tag) => `
      <button class="tag-btn ${tag === activeTag ? "active" : ""}" data-tag="${escapeHTML(tag)}">
        #${escapeHTML(tag)}
      </button>
    `
    )
    .join("");

  tagContainer.innerHTML = buttonsHTML;

  tagContainer.querySelectorAll(".tag-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTag = btn.dataset.tag;
      renderTags();
      renderGallery();
    });
  });
}

// 渲染篩選後的卡片牆
function renderGallery() {
  const filtered = allItems.filter((item) => {
    let matchTag = true;
    if (activeTag === FAV_FILTER_TAG) {
      matchTag = favoriteSet.has(item.favKey);
    } else if (activeTag !== "全部") {
      matchTag = item.tags.includes(activeTag);
    }

    const haystack = `${item.title} ${item.tip} ${item.prompt} ${item.model} ${item.tags.join(" ")}`.toLowerCase();
    const matchSearch = !searchQuery || haystack.includes(searchQuery);
    return matchTag && matchSearch;
  });

  statsCount.textContent = `共 ${filtered.length} 則靈感`;

  if (filtered.length === 0) {
    galleryGrid.innerHTML = "";
    const emptyMsg = emptyState.querySelector("p");
    if (emptyMsg) {
      emptyMsg.textContent =
        activeTag === FAV_FILTER_TAG
          ? "目前還沒有收藏任何指令，點擊卡片右上角的「☆」即可將喜愛的靈感收進這裡！"
          : "找不到符合條件的生圖指令，請嘗試其他關鍵字或切換標籤。";
    }
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  galleryGrid.innerHTML = filtered.map((item) => createCardHTML(item)).join("");
}

// 單張卡片 HTML 結構（右上角配置 ★ 收藏最愛按鈕）
function createCardHTML(item) {
  const isFav = favoriteSet.has(item.favKey);
  const hasImage = Boolean(item.image);

  const favButtonHTML = `
    <button
      class="fav-btn ${isFav ? "active" : ""}"
      data-favkey="${escapeHTML(item.favKey)}"
      type="button"
      aria-label="收藏最愛"
      aria-pressed="${isFav}"
      title="${isFav ? "取消收藏" : "加入收藏最愛"}"
    >${isFav ? "★" : "☆"}</button>
  `;

  const imageSection = hasImage
    ? `
      <div class="card-image-wrap">
        <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy" onerror="this.closest('.prompt-card').classList.add('no-image'); this.parentElement.style.display='none';">
        ${item.model ? `<span class="model-badge">${escapeHTML(item.model)}</span>` : ""}
      </div>
    `
    : "";

  const sourceLinkHTML =
    item.link && item.link !== "#"
      ? `<a href="${escapeHTML(item.link)}" target="_blank" rel="noopener noreferrer" class="source-link">原文出處 ↗</a>`
      : `<span>RSS 彙整</span>`;

  const tagsHTML = item.tags
    .map((t) => `<span class="mini-tag" data-tag="${escapeHTML(t)}">#${escapeHTML(t)}</span>`)
    .join("");

  return `
    <article class="prompt-card ${hasImage ? "" : "no-image"} ${isFav ? "is-favorited" : ""}">
      ${favButtonHTML}
      ${imageSection}
      <div class="card-body">
        <div class="card-meta">
          <span>${escapeHTML(item.date)}</span>
          ${sourceLinkHTML}
        </div>
        <h2 class="card-title">${escapeHTML(item.title)}</h2>
        ${item.tip ? `<p class="card-tip">${escapeHTML(item.tip)}</p>` : ""}

        <div class="prompt-box">
          <div class="prompt-header">
            <span class="prompt-label">Prompt 指令</span>
            <button class="copy-btn" data-id="${item.id}" type="button">
              複製指令
            </button>
          </div>
          <div class="prompt-text">${highlightPromptParams(item.prompt)}</div>
        </div>

        <div class="card-tags">${tagsHTML}</div>
      </div>
    </article>
  `;
}

// 自動高亮生圖參數
function highlightPromptParams(rawPrompt) {
  const safeText = escapeHTML(rawPrompt);
  const paramRegex = /(--[a-zA-Z]+\s+[^\s,]+|\b\d+mm\b|\bf\/\d+(?:\.\d+)?\b|\b8K\b|\b4K\b|\bfilm grain\b|\bbokeh\b|\bflatlay\b)/gi;
  return safeText.replace(paramRegex, '<span class="param-chip">$1</span>');
}

// 安全跳脫 HTML 字元
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 一鍵複製
async function copyToClipboard(text, btnElement) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    const originalText = btnElement.textContent;
    btnElement.textContent = "✓ 已複製";
    btnElement.classList.add("copied");
    showToast("已複製完整 Prompt 指令");

    setTimeout(() => {
      btnElement.textContent = originalText;
      btnElement.classList.remove("copied");
    }, 1800);
  } catch (err) {
    console.error("複製失敗：", err);
    showToast("複製失敗，請手動選取文字");
  }
}

let toastTimer;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2200);
}
