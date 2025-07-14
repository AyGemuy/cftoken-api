const {
  connect
} = require("puppeteer-real-browser");
async function createBrowser() {
  try {
    if (global.finished == true) return;
    global.browser = null;
    const {
      browser: _browser
    } = await connect({
      headless: false,
      turnstile: true,
      connectOption: {
        defaultViewport: null
      },
      disableXvfb: false
    });
    global.browser = _browser;
    browser.on("disconnected", async () => {
      if (global.finished == true) return;
      console.log("Browser disconnected");
      await new Promise(resolve => setTimeout(resolve, 3e3));
      await createBrowser();
    });
  } catch (e) {
    console.log(e.message);
    if (global.finished == true) return;
    await new Promise(resolve => setTimeout(resolve, 3e3));
    await createBrowser();
  }
}
createBrowser();