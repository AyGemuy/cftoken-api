const express = require("express");
const app = express();
const port = process.env.PORT || 3e3;
const bodyParser = require("body-parser");
const authToken = process.env.authToken || null;
const cors = require("cors");
const reqValidate = require("./module/reqValidate");
const axios = require("axios");

global.browserLength = 0;
global.browserLimit = Number(process.env.browserLimit) || 20;
global.timeOut = Number(process.env.timeOut || 6e6);

app.use(cors());
app.use(bodyParser.json({}));
app.use(bodyParser.urlencoded({
  extended: true
}));

async function getIPv4Address() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('Failed to fetch IPv4 address:', error.message);
    return null;
  }
}

async function getIPv6Address() {
  try {
    const response = await axios.get('https://api64.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('Failed to fetch IPv6 address:', error.message);
    return null;
  }
}

if (process.env.SKIP_LAUNCH != "true") require("./module/createPagepool");
if (process.env.SKIP_LAUNCH != "true") require("./module/createBrowser");

const getSource = require("./endpoints/getSource");
const {
  getPageTurnstileMin,
  solveTurnstileMin
} = require("./endpoints/solveTurnstile.min");
const solveTurnstileMax = require("./endpoints/solveTurnstile.max");
const solveRecaptchaV3 = require("./endpoints/solveRecaptcha.v3");
const solveRecaptchaV3Enterprise = require("./endpoints/solveRecaptcha.v3.enterprise");
const wafSession = require("./endpoints/wafSession");
const getVercel = require("./endpoints/getVercel");


app.post("/cf-clearance-scraper", async (req, res) => {
  try {
    const data = req.body;
    const check = reqValidate(data);
    if (check !== true) return res.status(400).json({
      code: 400,
      message: "Bad Request",
      schema: check
    });
    if (authToken && data.authToken !== authToken) return res.status(401).json({
      code: 401,
      message: "Unauthorized"
    });
    if (process.env.SKIP_LAUNCH != "true" && !global.browser) return res.status(500).json({
      code: 500,
      message: "The scanner is not ready yet. Please try again a little later."
    });
    var result = {
      code: 500
    };
    if (!data.maxSize) data.maxSize = 10;
    switch (data.mode) {
      case "vercel":
        result = await getVercel(data).then(res => {
          return {
            source: res,
            code: 200
          };
        }).catch(err => {
          return {
            code: 500,
            message: err.message
          };
        });
        break;
      case "source":
        result = await getSource(data).then(res => {
          return {
            source: res,
            code: 200
          };
        }).catch(err => {
          return {
            code: 500,
            message: err.message
          };
        });
        break;
      case "turnstile-min":
        var pagepool = await global.page_pool_manager.getPagePool(data.url);
        if (pagepool == null) {
          pagepool = await global.page_pool_manager.addPagePool(data);
        } else {
          if (data.maxSize != pagepool.maxSize && pagepool) {
            await global.page_pool_manager.removePagePool(data);
            await global.page_pool_manager.addPagePool(data);
          }
        }
        result = await solveTurnstileMin(data).then(res => {
          return {
            token: res,
            code: 200
          };
        }).catch(err => {
          return {
            code: 500,
            message: err.message
          };
        });
        break;
      case "turnstile-max":
        result = await solveTurnstileMax(data).then(res => {
          return {
            token: res,
            code: 200
          };
        }).catch(err => {
          return {
            code: 500,
            message: err.message
          };
        });
        break;
      case "waf-session":
        result = await wafSession(data).then(res => {
          return {
            ...res,
            code: 200
          };
        }).catch(err => {
          return {
            code: 500,
            message: err.message
          };
        });
        break;
      case "recaptcha-v3":
        result = await solveRecaptchaV3(data).then(res => {
          return {
            ...res,
            code: 200
          };
        }).catch(err => {
          return {
            code: 500,
            message: err.message
          };
        });
        break;
      case "recaptcha-v3-enterprise":
        result = await solveRecaptchaV3Enterprise(data).then(res => {
          return {
            ...res,
            code: 200
          };
        }).catch(err => {
          return {
            code: 500,
            message: err.message
          };
        });
        break;
    }
    res.status(result.code ?? 500).send(result);
  } catch (err) {
    res.status(result.code ?? 504).send(err.msg);
  }
});

app.post("/cf-clearance-scraper/addPagePool", async (req, res) => {
  try {
    const data = req.body;
    const check = reqValidate(data);
    if (check !== true) return res.status(400).json({
      code: 400,
      message: "Bad Request",
      schema: check
    });
    if (authToken && data.authToken !== authToken) return res.status(401).json({
      code: 401,
      message: "Unauthorized"
    });
    if (process.env.SKIP_LAUNCH != "true" && !global.browser) return res.status(500).json({
      code: 500,
      message: "The scanner is not ready yet. Please try again a little later."
    });
    var result = {
      code: 500
    };
    if (!data.maxSize) {
      data.maxSize = 10;
    }
    const status = await global.page_pool_manager.addPagePool(data);
    if (status == null) {
      result = {
        code: 200,
        message: "addPagePool exists"
      };
    } else {
      result = {
        code: 200,
        message: "addPagePool success"
      };
    }
    res.status(result.code ?? 500).send(result);
  } catch (err) {
    res.status(result.code ?? 504).send(err.message);
  }
});

app.post("/cf-clearance-scraper/removePagePool", async (req, res) => {
  try {
    const data = req.body;
    const check = reqValidate(data);
    if (check !== true) return res.status(400).json({
      code: 400,
      message: "Bad Request",
      schema: check
    });
    if (authToken && data.authToken !== authToken) return res.status(401).json({
      code: 401,
      message: "Unauthorized"
    });
    if (process.env.SKIP_LAUNCH != "true" && !global.browser) return res.status(500).json({
      code: 500,
      message: "The scanner is not ready yet. Please try again a little later."
    });
    var result = {
      code: 500
    };
    const status = await global.page_pool_manager.removePagePool(data);
    if (status == null) {
      result = {
        code: 200,
        message: "removePagePool failed"
      };
    } else {
      result = {
        code: 200,
        message: "removePagePool success"
      };
    }
    res.status(result.code ?? 500).send(result);
  } catch (err) {
    res.status(result.code ?? 504).send(result);
  }
});

app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: "Not Found"
  });
});

process.on("uncaughtException", function(err) {
  console.log(err);
  console.log("No worries,still working on~~~");
});

if (process.env.NODE_ENV !== "development") {
  let server = app.listen(port, async () => {
    console.log(`Server running on port ${port}`);

    const ipv4 = await getIPv4Address();
    if (ipv4) {
      console.log(`Server IPv4 address: ${ipv4}`);
    }

    const ipv6 = await getIPv6Address();
    if (ipv6) {
      console.log(`Server IPv6 address: ${ipv6}`);
    }
  });
  try {
    server.timeout = global.timeOut;
  } catch (e) {}
}

if (process.env.NODE_ENV == "development") module.exports = app;
