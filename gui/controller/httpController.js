const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const { app } = require("electron");
const isDev = !app.isPackaged;

const JAVA_CORE_PATH = isDev ? path.join(__dirname, "..", "resources", "lib", "tvc-http-core.jar") : path.join(process.resourcesPath, "resources", "lib", "tvc-http-core.jar");
const JAVA_COMMAND = "java";
let javaCoreProcess = null;

async function runTestcasesSequentially(testcases, globalConfig, onUpdate) {
  if (javaCoreProcess) {
    return Promise.reject(new Error("Java Core Process is already running. Please stop it first."));
  }
  if (!testcases || testcases.length === 0) {
    onUpdate({ type: "LOG", level: "INFO", content: "No testcases to run." });
    return [];
  }
  const command = JAVA_COMMAND;
  const args = ["-jar", JAVA_CORE_PATH];

  const initPayload = {
    type: "INIT",
    globalConfig: globalConfig,
    testcases: testcases,
  };
  const jsonString = JSON.stringify(initPayload, null, 2);
  return new Promise((resolve, reject) => {
    const allResults = [];
    let finalStatus = null;
    const totalCases = testcases.length;

    const caseNamesMap = testcases.reduce((acc, c, index) => {
      acc[index + 1] = c.name || `Case ${index + 1}`;
      return acc;
    }, {});
    const child = spawn(command, args);
    javaCoreProcess = child;
    child.stdin.write(jsonString);
    child.stdin.end();
    onUpdate({ type: "LOG", level: "INFO", content: `[RUNNER] Starting Core... Total ${totalCases} cases.` });
    let stdoutBuffer = "";
    const processCoreMessages = (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split(os.EOL);
      stdoutBuffer = lines.pop();
      lines.forEach((line) => {
        if (!line.trim()) return;
        try {
          const msg = JSON.parse(line.trim());
          if (msg.type === "RESULT_CASE") {
            const caseIndex = msg.caseIndex;
            const caseName = caseNamesMap[caseIndex] || `Case ${caseIndex}`;
            const payload = msg.payload;
            const caseResult = {
              case: caseName,
              status: payload.status === "SUCCESS" ? "SUCCESS" : "FAILURE",
              result: payload,
            };
            allResults.push(caseResult);
            onUpdate({
              type: "RUN_END",
              status: caseResult.status,
              caseIndex: caseIndex,
              caseName: caseName,
              moduleName: msg.moduleName,
              payload: payload,
              content: `[RUNNER] ${caseName} completed.`,
            });
          } else if (msg.type === "RUN_COMPLETE_CORE") {
            finalStatus = "SUCCESS";
            onUpdate({ type: "RUN_COMPLETE", content: `All ${totalCases} testcases finished.` });
          } else if (msg.type === "LOG" && msg.content && msg.content.includes("Executing case")) {
            const match = msg.content.match(/Executing case (\d+)\/(\d+)/);
            if (match) {
              const caseIndex = parseInt(match[1]);
              const caseName = caseNamesMap[caseIndex] || `Case ${caseIndex}`;
              onUpdate({
                type: "LOG",
                level: "INFO",
                content: `Executing case ${caseIndex}/${totalCases} (${caseName}) ...`,
                caseIndex: caseIndex,
              });
            } else {
              onUpdate(msg);
            }
          } else {
            onUpdate(msg);
          }
        } catch (e) {
          onUpdate({ type: "LOG", level: "ERROR", content: `[Core Log Error] Cannot parse line: ${line.trim()}` });
        }
      });
    };
    child.stdout.on("data", processCoreMessages);
    child.stderr.on("data", (data) => {
      onUpdate({ type: "LOG", level: "FATAL", content: `[Core System Error] ${data.toString().trim()}` });
    });
    child.on("close", (code) => {
      javaCoreProcess = null;
      if (stdoutBuffer) {
        processCoreMessages(os.EOL + stdoutBuffer);
      }
      if (code === 0 && finalStatus === "SUCCESS") {
        resolve(allResults);
      } else {
        let errorMessage = `Test execution failed. Exit code: ${code || "N/A"}.`;
        if (code !== 0) {
          errorMessage += " Core terminated with a non-zero exit code (System Error).";
        }
        if (finalStatus !== "SUCCESS") {
          errorMessage += " Core did not send the RUN_COMPLETE_CORE signal (Protocol Error).";
        }
        onUpdate({ type: "LOG", level: "FATAL", content: `[RUNNER] ${errorMessage}` });
        reject(new Error(errorMessage));
      }
    });
    child.on("error", (err) => {
      javaCoreProcess = null;
      const errorMessage = `Failed to start Core process: ${err.message}. Check if ${command} and ${args[1] || ""} exist.`;
      onUpdate({ type: "LOG", level: "FATAL", content: `[RUNNER] ${errorMessage}` });
      reject(new Error(errorMessage));
    });
  });
}
function stopCoreProcess() {
  if (javaCoreProcess) {
    javaCoreProcess.kill("SIGTERM");
    javaCoreProcess = null;
    console.log("[RUNNER] Core process stopped manually.");
    return true;
  }
  return false;
}
module.exports = {
  runTestcasesSequentially,
  stopCoreProcess,
};
