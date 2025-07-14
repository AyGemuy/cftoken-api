function getSource({
  url,
  proxy,
  callback,
  axios
}) {
  return new Promise(async (resolve, reject) => {
    if (!url) return reject("Missing url parameter");
    const context = await global.browser.createBrowserContext().catch(() => null);
    if (!context) return reject("Failed to create browser context");
    let isResolved = false;
    const {
      proxyRequest
    } = await import("puppeteer-proxy");
    var cl = setTimeout(async () => {
      if (!isResolved) {
        await context.close();
        reject("Timeout Error");
      }
    }, global.timeOut || 6e4);
    try {
      const page = await context.newPage();
      await page.setRequestInterception(true);
      page.on("request", async request => {
        try {
          if (proxy) {
            await proxyRequest({
              page: page,
              proxyUrl: `http://${proxy.username ? `${proxy.username}:${proxy.password}@` : ""}${proxy.host}:${proxy.port}`,
              request: request
            });
          } else {
            request.continue();
          }
        } catch (e) {}
      });
      page.on("response", async res => {
        try {
          if (true) {
            await page.waitForNavigation({
              waitUntil: "load",
              timeout: 5e3
            }).catch(() => {});
            if (axios) {
              const axios = await fs.readFileSync(path.join(__dirname, "../src/data/axios.min.js"), "utf8");
              await page.evaluate(axios);
            }
            const html = await page.content();
            if (callback) {
              await page.evaluate(eval(callback));
              await page.waitForSelector("#status", {
                timeout: 6e4
              });
              const text = await page.$eval("#status", el => el.innerText);
              await context.close();
              isResolved = true;
              clearInterval(cl);
              resolve(text);
            } else {
              await context.close();
              isResolved = true;
              clearInterval(cl);
              resolve(html);
            }
          }
        } catch (e) {}
      });
      await page.goto(url, {
        waitUntil: "domcontentloaded"
      });
    } catch (e) {
      if (!isResolved) {
        await context.close();
        clearInterval(cl);
        reject(e.message);
      }
    }
  });
}
module.exports = getSource;