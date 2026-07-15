import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema, ReadResourceResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";

const REPORT_URI = "ui://widget/tiktok-ads-report-v13.html";
const endpoint = process.env.MCP_ENDPOINT;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function encode(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function hostHarness(resourceHtml, toolResult) {
  const encodedHtml = encode(resourceHtml);
  const encodedResult = encode(JSON.stringify(toolResult));
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#eef4f1}iframe{width:100%;height:1100px;border:0}</style></head><body><iframe id="frame" sandbox="allow-scripts allow-same-origin"></iframe><script>
    const decode=(value)=>new TextDecoder().decode(Uint8Array.from(atob(value),char=>char.charCodeAt(0)));
    const html=decode(${JSON.stringify(encodedHtml)});
    const result=JSON.parse(decode(${JSON.stringify(encodedResult)}));
    const frame=document.getElementById("frame");
    const send=(message)=>frame.contentWindow.postMessage({jsonrpc:"2.0",...message},"*");
    window.addEventListener("message",(event)=>{
      if(event.source!==frame.contentWindow)return;
      const message=event.data;
      if(message?.method==="ui/initialize"){
        send({id:message.id,result:{protocolVersion:message.params.protocolVersion,hostInfo:{name:"decision-qa",version:"1.0.0"},hostCapabilities:{serverTools:{}},hostContext:{theme:"light",displayMode:"inline",locale:"en-US",timeZone:"America/Los_Angeles",viewport:{width:900,height:1100,maxHeight:1100}}}});
      }
      if(message?.method==="ui/notifications/initialized")send({method:"ui/notifications/tool-result",params:result});
    });
    frame.srcdoc=html;
  </script></body></html>`;
}

async function main() {
  assert(endpoint, "Set MCP_ENDPOINT explicitly so QA cannot accidentally validate a different deployment.");
  const client = new Client(
    { name: "qa-decision-cards", version: "1.0.0" },
    { capabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } } }
  );
  const transport = new StreamableHTTPClientTransport(new URL(endpoint));
  await client.connect(transport);

  let browser;
  try {
    const tools = await client.listTools();
    const expectedTools = [
      "get_creative_performance_demo",
      "review_campaign_launch_demo",
      "review_campaign_update_demo"
    ];
    for (const name of expectedTools) {
      const tool = tools.tools.find((candidate) => candidate.name === name);
      assert(tool, `${name} is missing from tools/list.`);
      assert(tool._meta?.ui?.resourceUri === REPORT_URI, `${name} has the wrong ui.resourceUri.`);
      assert(tool._meta?.["openai/outputTemplate"] === REPORT_URI, `${name} has the wrong output template.`);
      assert(tool.annotations?.readOnlyHint === true, `${name} must be read-only.`);
      assert(tool.annotations?.destructiveHint === false, `${name} must not be destructive.`);
      assert(tool.description?.includes("demo"), `${name} does not disclose demo behavior.`);
    }

    const resource = await client.request(
      { method: "resources/read", params: { uri: REPORT_URI } },
      ReadResourceResultSchema
    );
    const resourceHtml = resource.contents[0]?.text || "";
    assert(resourceHtml.includes("extractDecisionState"), "Decision-state hydration is missing from the widget resource.");
    assert(resourceHtml.includes("creative-decision"), "Creative card renderer is missing.");
    assert(resourceHtml.includes("launch-decision"), "Launch card renderer is missing.");
    assert(resourceHtml.includes("update-decision"), "Update card renderer is missing.");
    assert(resourceHtml.includes("readChatGptPayload"), "Source-authoritative ChatGPT hydration is missing.");
    assert(resourceHtml.includes("setWidgetState"), "ChatGPT decision UI-state persistence is missing.");

    const creativeResult = await client.callTool(
      {
        name: "get_creative_performance_demo",
        arguments: { campaignName: "QA Summer Launch" }
      },
      CallToolResultSchema
    );
    const creative = creativeResult.structuredContent?.decisionState;
    assert(creative?.kind === "creative_performance", "Creative tool returned the wrong card kind.");
    assert(creative?.cardInstanceId, "Creative card instance ID is missing.");
    assert(creative?.provenance?.sourceKind === "demo_fixture", "Creative provenance is missing.");
    assert(creative?.provenance?.mutationOccurred === false, "Creative demo must not claim a mutation.");
    assert(creative?.campaign?.name === "QA Summer Launch", "Creative tool ignored the requested campaign name.");
    assert(creative?.creatives?.length === 3, "Creative tool returned the wrong row count.");
    assert(
      JSON.stringify(creative.creatives.map((item) => item.fatigue.status)) === JSON.stringify(["no_signal_returned", "detected", "unavailable"]),
      "Creative fatigue availability states are incomplete."
    );
    assert(!JSON.stringify(creative).includes("TikTok returned"), "Creative fixture is written as a live TikTok response.");

    const launchResult = await client.callTool(
      { name: "review_campaign_launch_demo", arguments: { campaignName: "QA Launch", dailyBudget: 1800 } },
      CallToolResultSchema
    );
    const launch = launchResult.structuredContent?.decisionState;
    assert(launch?.kind === "campaign_launch_review", "Launch tool returned the wrong card kind.");
    assert(launch?.cardInstanceId, "Launch card instance ID is missing.");
    assert(launch?.provenance?.sourceKind === "demo_fixture", "Launch provenance is missing.");
    assert(launch?.campaign?.dailyBudget === 1800, "Launch tool ignored the requested budget.");
    assert(launch?.exposure?.amount === 28800, "Launch exposure math is incorrect.");
    assert(launch?.preflight?.every((item) => item.source), "Launch preflight sources are missing.");
    assert(launch?.demoReceipt?.mutationOccurred === false, "Launch demo receipt must disclose no mutation.");
    assert(launch?.demoReceipt?.campaignId?.startsWith("demo-"), "Launch demo receipt looks like a TikTok object ID.");

    const updateResult = await client.callTool(
      {
        name: "review_campaign_update_demo",
        arguments: { campaignName: "QA Update", currentBudget: 2000, proposedBudget: 2500 }
      },
      CallToolResultSchema
    );
    const update = updateResult.structuredContent?.decisionState;
    assert(update?.kind === "campaign_update_review", "Update tool returned the wrong card kind.");
    assert(update?.cardInstanceId, "Update card instance ID is missing.");
    assert(update?.provenance?.sourceKind === "demo_fixture", "Update provenance is missing.");
    assert(update?.change?.difference === 500, "Update delta is incorrect.");
    assert(update?.change?.differencePercent === 25, "Update percentage is incorrect.");
    assert(JSON.stringify(update?.checks?.submittedFields) === JSON.stringify(["budget"]), "Update scope must contain only budget.");
    assert(update?.checks?.currentSpendSource === "demo_fixture", "Update spend source is missing.");
    assert(update?.checks?.minimumBudgetSource === "tiktok_tool_contract_calculation", "Update minimum-budget contract source is missing.");
    assert(update?.demoReceipt?.mutationOccurred === false, "Update demo receipt must disclose no mutation.");
    const secondUpdateResult = await client.callTool(
      {
        name: "review_campaign_update_demo",
        arguments: { campaignName: "QA Update", currentBudget: 2000, proposedBudget: 2500 }
      },
      CallToolResultSchema
    );
    assert(
      secondUpdateResult.structuredContent?.decisionState?.cardInstanceId !== update.cardInstanceId,
      "Separate tool calls reuse the same card instance ID."
    );
    const decisionStateText = JSON.stringify([creative, launch, update]).toLowerCase();
    assert(!decisionStateText.includes('"pause"'), "Decision states must not introduce a Pause action.");
    assert(!decisionStateText.includes('"ai_analysis"'), "Decision states must not embed AI analysis.");

    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: true });
    const cases = [
      {
        name: "creative",
        result: creativeResult,
        ready: ".creative-decision",
        interact: async (frame) => {
          await frame.locator('[data-creative-key="product-demo"]').click();
          assert((await frame.locator(".fatigue-detail h2").innerText()) === "Demo: fatigue signal present", "Creative row selection did not update detail evidence.");
          assert(await frame.locator('[data-creative-key="product-demo"]').evaluate((element) => document.activeElement === element), "Creative selection lost keyboard focus.");
        }
      },
      {
        name: "launch",
        result: launchResult,
        ready: ".launch-decision",
        interact: async (frame) => {
          const confirm = frame.locator("#launch-demo-confirm");
          assert(await confirm.isDisabled(), "Launch confirmation should start disabled.");
          await frame.locator("#launch-demo-ack").check();
          assert(!(await confirm.isDisabled()), "Launch acknowledgement did not enable confirmation.");
          await confirm.click();
          await frame.getByText("Submission simulation complete", { exact: true }).waitFor();
          assert(await frame.locator("#launch-demo-receipt").evaluate((element) => document.activeElement === element), "Launch receipt did not receive focus.");
        }
      },
      {
        name: "update",
        result: updateResult,
        ready: ".update-decision",
        interact: async (frame) => {
          await frame.locator("#update-demo-confirm").click();
          await frame.getByText("Budget-update simulation complete", { exact: true }).waitFor();
          assert(await frame.locator("#update-demo-receipt").evaluate((element) => document.activeElement === element), "Update receipt did not receive focus.");
        }
      }
    ];

    for (const testCase of cases) {
      const errors = [];
      const page = await browser.newPage({ viewport: { width: 900, height: 1150 } });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setContent(hostHarness(resourceHtml, testCase.result), { waitUntil: "load" });
      const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
      assert(frame, `${testCase.name} iframe did not mount.`);
      await frame.locator(testCase.ready).waitFor({ timeout: 10000 });
      assert((await frame.locator(".decision-badge").innerText()).includes("Demo"), `${testCase.name} is missing the demo badge.`);
      for (const width of [736, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const initialOverflow = await frame.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert(initialOverflow <= 1, `${testCase.name} overflows the ${width}px viewport by ${initialOverflow}px.`);
      }
      if (testCase.name === "creative") {
        assert(
          await frame.locator(".creative-table thead").evaluate((element) => getComputedStyle(element).display !== "none"),
          "Creative mobile layout removes semantic table headers."
        );
      } else {
        const confirmButton = frame.locator(".decision-primary");
        assert((await confirmButton.evaluate((element) => element.getBoundingClientRect().height)) >= 44, `${testCase.name} mobile CTA is below 44px.`);
      }
      await page.setViewportSize({ width: 900, height: 1150 });
      await testCase.interact(frame);
      assert(errors.length === 0, `${testCase.name} emitted browser errors: ${errors.join(" | ")}`);
      await page.close();
    }

    console.log(JSON.stringify({ ok: true, endpoint, tools: expectedTools, resource: REPORT_URI }, null, 2));
  } finally {
    if (browser) await browser.close();
    await transport.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
