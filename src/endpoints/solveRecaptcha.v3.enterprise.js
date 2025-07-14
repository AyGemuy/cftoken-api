function solveRecaptcha({
  url,
  proxy,
  siteKey,
  action
}) {
  return new Promise(async (resolve, reject) => {
    if (!url) return reject("Missing url parameter");
    if (!siteKey) return reject("Missing siteKey parameter");
    const context = await global.browser.createBrowserContext().catch(() => null);
    if (!context) return reject("Failed to create browser context");
    let isResolved = false;
    const {
      proxyRequest
    } = await import("puppeteer-proxy");
    const {
      RequestInterceptionManager
    } = await import("puppeteer-intercept-and-modify-requests");
    var cl = setTimeout(async () => {
      if (!isResolved) {
        await context.close();
        reject("Timeout Error");
      }
    }, global.timeOut || 6e4);
    try {
      const page = await context.newPage();
      const client = await page.target().createCDPSession();
      const interceptManager = new RequestInterceptionManager(client);
      await page.setRequestInterception(true);
      page.on("request", async request => {
        try {
          if ([url, url + "/"].includes(request.url())) return request.abort();
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
      await interceptManager.intercept({
        urlPattern: url,
        resourceType: "Document",
        modifyResponse({
          body
        }) {
          return {
            body: String(require("fs").readFileSync("./src/data/reCAPTCHAV3_enterprise.html")).replace(/<reCAPTCHA_site_key>/g, siteKey).replace(/<reCAPTCHA_site_key>/g, action),
            status: 200
          };
        }
      });
      await page.goto(url, {
        waitUntil: "domcontentloaded"
      });
      await page.waitForSelector(".grecaptcha-badge", {
        timeout: 6e4
      });
      const iframes = await page.$$("iframe");
      const iframe1 = await iframes[0].contentFrame();
      await iframe1.waitForSelector("#recaptcha-token", {
        timeout: 6e4
      });
      await page.waitForSelector("#my_token", {
        timeout: 6e4
      });
      const token = await page.evaluate(() => {
        try {
          return document.querySelector("#my_token").value;
        } catch (e) {
          return null;
        }
      });
      isResolved = true;
      clearInterval(cl);
      await context.close();
      if (!token || token.length < 10) return reject("Failed to get token");
      return resolve({
        token: token
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
module.exports = solveRecaptcha;