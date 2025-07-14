const {
  getPageTurnstileMin,
  solveTurnstileMin
} = require("../endpoints/solveTurnstile.min");
class Page {
  constructor(page) {
    this.page = page;
    this.available = true;
  }
  setAvailable(available) {
    this.available = available;
  }
  isAvailable() {
    return this.available;
  }
}
class PagePool {
  constructor(params) {
    this.params = params;
    this.type = params.mode;
    this.maxSize = params.maxSize;
    this.pool = [];
  }
  async usePage(callback) {
    while (true) {
      for (let i = 0; i < this.pool.length; i++) {
        if (this.pool[i].isAvailable()) {
          this.pool[i].setAvailable(false);
          const data = await callback(this.pool[i].page);
          this.pool[i].setAvailable(true);
          return data;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  addPage(page) {
    if (this.pool.length < this.maxSize) {
      this.pool.push(new Page(page));
      global.browserLength++;
    }
  }
  async initPool() {
    for (let i = 0; i < this.maxSize; i++) {
      if (this.type === "turnstile-min") {
        const page = await getPageTurnstileMin(this.params);
        this.addPage(page);
      }
    }
  }
  removePage(page) {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].getPage() === page) {
        this.pool.splice(i, 1);
        global.browserLength--;
        break;
      }
    }
  }
}
class PagePoolManager {
  constructor() {
    this.poolMap = new Map();
    this.lock = false;
    setInterval(() => this.checkIdlePool(), 2e4);
  }
  async getPagePool(url) {
    while (this.lock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.lock = true;
    try {
      if (this.poolMap.has(url)) {
        this.poolMap.get(url).expireTime = Date.now() + 60 * 1e3;
        return this.poolMap.get(url).pool;
      } else {
        return null;
      }
    } finally {
      this.lock = false;
    }
  }
  async addPagePool(params) {
    while (this.lock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.lock = true;
    try {
      if (this.poolMap.has(params.url)) {
        return this.getPagePool(params.url);
      } else {
        const pagePool = new PagePool(params);
        await pagePool.initPool();
        this.poolMap.set(params.url, {
          pool: pagePool,
          expireTime: Date.now() + 60 * 1e3
        });
        return pagePool;
      }
    } finally {
      this.lock = false;
    }
  }
  async removePagePool(params) {
    while (this.lock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.lock = true;
    try {
      if (this.poolMap.has(params.url)) {
        const pagePool = this.poolMap.get(params.url).pool;
        for (let i = 0; i < pagePool.pool.length; i++) {
          const page = pagePool.pool[i];
          await page.page.close();
        }
        this.poolMap.delete(params.url);
        return true;
      } else {
        return null;
      }
    } finally {
      this.lock = false;
    }
  }
  async checkIdlePool() {
    for (let [url, pool_obj] of this.poolMap) {
      if (Date.now() > pool_obj.expireTime) {
        await this.removePagePool({
          url: url
        });
        console.log("removePagePool:" + url);
        continue;
      }
    }
  }
}
async function createPagePoolManager() {
  try {
    if (global.finished == true) return;
    global.page_pool_manager = null;
    console.log("Launching the page_pool_manager...");
    global.page_pool_manager = new PagePoolManager();
    setInterval(() => global.page_pool_manager.checkIdlePool(), 1e3);
  } catch (e) {
    console.log(e.message);
    if (global.finished == true) return;
    await new Promise(resolve => setTimeout(resolve, 3e3));
    await createPagePoolManager();
  }
}
createPagePoolManager();