package dinhhung;

import javax.swing.*;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.util.stream.Collectors;
import java.util.List;
import java.util.Map;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import dinhhung.config.TestConfig;
import dinhhung.config.Environment;
import dinhhung.core.TestCase;
import dinhhung.core.TestExecutor;
import dinhhung.core.ResponseValidator;

import org.json.JSONArray;
import org.json.JSONObject;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public class App {

    public static final boolean IS_DEV_MODE = false;
    private static final boolean SHOW_INPUT_VALUES = false;
    private static final boolean IS_DEBUGGING_READING_INPUT = false;
    private static final String TVC_DIRECTORY = "log/tvc";
    private static final String INPUT_PAYLOAD_FILE = TVC_DIRECTORY + "/payload_input.json";
    private static final String FAILURE_DETAIL_FILE = TVC_DIRECTORY + "/failed_cases_detail.txt";

    private static final String debug_value = "{\n" +
            "  \"type\": \"INIT\",\n" +
            "  \"globalConfig\": {\n" +
            "    \"max_retries\": 3,\n" +
            "    \"connect_timeout\": 10,\n" +
            "    \"read_timeout\": 350,\n" +
            "    \"activeEnv\": \"development\",\n" +
            "    \"envs\": [\n" +
            "      { \"name\": \"development\", \"url\": \"http://localhost:3010/\", \"active\": true },\n" +
            "      { \"name\": \"production\", \"url\": \"http://10.3.0.124/\", \"active\": false }\n" +
            "    ]\n" +
            "  },\n" +
            "  \"testcases\": [\n" +
            "    { \"test_id\": 1, \"method\": \"GET\", \"api\": \"v1/case1\", \"expected_code\": \"200\" },\n" +
            "    { \"test_id\": 2, \"method\": \"POST\", \"api\": \"v1/case2\", \"expected_code\": \"400\" },\n" +
            "    { \"test_id\": 3, \"method\": \"DELETE\", \"api\": \"v1/case3\", \"expected_code\": \"204\" }\n" +
            "  ]\n" +
            "}";
    private static final PrintWriter STDOUT = new PrintWriter(System.out, true);


    public static void main(String[] args) {
        String inputJsonString = "";

        // --- BƯỚC 1: Đọc Input ---
        if (IS_DEBUGGING_READING_INPUT) {
            inputJsonString = debug_value;
        } else {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(System.in))) {
                inputJsonString = reader.lines().collect(Collectors.joining(System.lineSeparator()));
            } catch (Exception e) {
                sendErrorLog("FATAL", "[JAVA CORE] Lỗi khi đọc STDIN: " + e.getMessage());
                // Thoát lỗi nếu không đọc được input
                System.exit(1);
                return;
            }
        }

        if (inputJsonString.isEmpty()) {
            sendErrorLog("FATAL", "[JAVA CORE] Không nhận được dữ liệu JSON từ STDIN.");
            sendRunCompleteCore("FAILURE", "Không nhận được input từ hệ thống chính.");
            // Thoát lỗi nếu không có input
            System.exit(1);
            return;
        }

        // --- BƯỚC 2: Xử lý File (tạo thư mục, xóa file cũ) ---
        try {
            // Đảm bảo thư mục tvc tồn tại
            Files.createDirectories(Paths.get(TVC_DIRECTORY));

            // Xóa file chi tiết lỗi cũ để bắt đầu lần chạy mới
            Files.deleteIfExists(Paths.get(FAILURE_DETAIL_FILE));

        } catch (IOException e) {
            sendErrorLog("FATAL", "[JAVA CORE] Không thể tạo thư mục hoặc xóa file cũ: " + e.getMessage());
            sendRunCompleteCore("FAILURE", "Lỗi I/O khi chuẩn bị thư mục.");
            // Thoát lỗi nếu I/O thất bại
            System.exit(1);
            return;
        }

        // --- BƯỚC 3: Ghi Payload vào input.json ---
        try {
            savePayloadToFile(inputJsonString, INPUT_PAYLOAD_FILE, false); // Ghi đè
            sendLog("INFO", "[JAVA CORE] Đã lưu payload vào: " + INPUT_PAYLOAD_FILE);
        } catch (IOException e) {
            sendErrorLog("WARNING", "[JAVA CORE] Lỗi khi lưu payload vào file: " + e.getMessage());
        }

        if (SHOW_INPUT_VALUES){
            showReceivedDataWindow(formatJson(inputJsonString));
        }

        // --- BƯỚC 4: Parse JSON và thực thi loạt test case ---
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode rootNode = mapper.readTree(inputJsonString);

            String payloadType = rootNode.path("type").asText();
            if (!"INIT".equals(payloadType)) {
                throw new Exception("Payload không phải là loại 'INIT'. Loại nhận được: " + payloadType);
            }

            // --- 1. Xử lý Global Config ---
            TestConfig testConfig = extractTestConfig(rootNode.path("globalConfig"));

            // --- 2. Xử lý và thực thi danh sách Testcases ---
            JsonNode testcasesNode = rootNode.path("testcases");
            if (testcasesNode.isNull() || !testcasesNode.isArray()) {
                throw new Exception("Không tìm thấy danh sách 'testcases' hợp lệ trong payload.");
            }

            for (int i = 0; i < testcasesNode.size(); i++) {
                JsonNode testcaseNode = testcasesNode.get(i);

                sendLog("INFO", "[CORE RUNNER] Executing case " + (i + 1) + "/" + testcasesNode.size());

                // Thực thi từng test case
                executeSingleTestcase(testConfig, testcaseNode, i + 1, testcasesNode.size());
            }

            // --- 3. Gửi tín hiệu hoàn thành cuối cùng ---
            sendRunCompleteCore("SUCCESS", "Tất cả test case đã hoàn thành.");

            // >>> BỔ SUNG: BUỘC JVM THOÁT THÀNH CÔNG (Exit Code 0) <<<
            // Điều này ngăn chặn các luồng OkHttpClient còn sót lại gây ra lỗi non-zero exit code
            System.exit(0);

        } catch (Exception e) {
            sendErrorLog("FATAL", "[JAVA CORE] Lỗi khi xử lý payload tổng hợp: " + e.getMessage());
            sendRunCompleteCore("FAILURE", "Lỗi nghiêm trọng khi khởi chạy Core: " + e.getMessage());

            // >>> BỔ SUNG: BUỘC JVM THOÁT VỚI MÃ LỖI (Exit Code 1) <<<
            System.exit(1);
        }
    }

    /**
     * Tách Global Config và Environments từ Root Node.
     */
    private static TestConfig extractTestConfig(JsonNode globalConfigNode) throws Exception {
        if (globalConfigNode.isNull()) {
            throw new Exception("Không tìm thấy 'globalConfig' trong payload.");
        }

        TestConfig testConfig = new TestConfig();

        // Cấu hình Global
        testConfig.setMaxRetries(globalConfigNode.path("max_retries").asInt());
        testConfig.setConnectTimeout(globalConfigNode.path("connect_timeout").asInt());
        testConfig.setReadTimeout(globalConfigNode.path("read_timeout").asInt());

        // Cấu hình Environments
        JsonNode envsNode = globalConfigNode.path("envs");
        if (envsNode.isArray()) {
            for (JsonNode envNode : envsNode) {
                Environment env = new Environment();
                env.setName(envNode.path("name").asText());
                env.setUrl(envNode.path("url").asText());
                env.setActive(envNode.path("active").asBoolean());
                testConfig.getEnv().add(env);
            }
        }
        return testConfig;
    }
    /**
     * Thực thi một test case duy nhất và gửi kết quả RESULT_CASE.
     * CẬP NHẬT: Thực hiện lọc HTML VÀ cập nhật ResponseValidator.
     */
    private static void executeSingleTestcase(TestConfig testConfig, JsonNode testcaseNode, int index, int total) {
        String caseName = "Case " + index;
        String finalResponseBody = null; // Response Body đã được lọc hoặc Body gốc

        TestCase testCase = null;
        try {
            testCase = new TestCase(testcaseNode);
            caseName = testCase.getName() != null ? testCase.getName() : caseName;

            // Thực thi test
            TestExecutor executor = new TestExecutor(testConfig, testCase);
            executor.execute();

            // Lấy kết quả validation
            ResponseValidator validator = testCase.getResponseValidator();

            // >>> BƯỚC 1: LỌC RESPONSE BODY (Nếu là HTML) <<<
            String rawResponseBody = validator.getRawResponseBody();

            if (rawResponseBody != null && rawResponseBody.trim().startsWith("<!DOCTYPE html>")) {
                finalResponseBody = extractPreContentFromHtml(rawResponseBody);
            } else {
                finalResponseBody = rawResponseBody; // Giữ nguyên nếu không phải HTML (thường là JSON)
            }

            // >>> BƯỚC 2: GỬI BODY ĐÃ LỌC VÀO VALIDATOR (để dùng cho file chi tiết lỗi) <<<
            validator.setFilteredResponseBody(finalResponseBody);

            List<Map<String, String>> validateResults = validator.getValidateResults();
            boolean allPassed = validator.isAllPassed();

            // --- Ghi chi tiết case thất bại vào detail.txt ---
            if (!allPassed) {
                // Validator đã tự động cập nhật failedCaseResponseDetails với BODY ĐÃ LỌC
                String detail = formatFailedCaseDetail(index, caseName, validateResults, validator);
                savePayloadToFile(detail, FAILURE_DETAIL_FILE, true); // Ghi nối (append)
            }
            // ----------------------------------------------------

            // Gửi RESULT_CASE payload (Sử dụng finalResponseBody đã lọc)
            sendResultCase(
                    index,
                    caseName,
                    allPassed ? "SUCCESS" : "FAILURE",
                    "Kết quả test case: " + caseName,
                    validateResults,
                    finalResponseBody,
                    testCase.getModuleName(),
                    testCase.getTestId()
            );

        } catch (Exception e) {
            sendErrorLog("ERROR", "[JAVA CORE] Lỗi thực thi Case " + index + " (" + caseName + "): " + e.getMessage());
            // Gửi RESULT_CASE thất bại (CẬP NHẬT TRUYỀN THAM SỐ)
            sendResultCase(
                    index,
                    caseName,
                    "FAILURE",
                    "Lỗi khi thực thi test case: " + e.getMessage(),
                    null,
                    null,
                    null,
                    testCase != null ? testCase.getTestId() : "N/A"
            );
        }
    }
    // --- HÀM GHI FILE VÀ HỖ TRỢ CHI TIẾT LỖI ---
    /**
     * Ghi chuỗi payload vào một file.
     * @param payload Chuỗi cần ghi.
     * @param filePath Đường dẫn tương đối đến file.
     * @param append Có ghi nối (true) hay ghi đè (false).
     * @throws IOException Nếu có lỗi trong quá trình tạo thư mục hoặc ghi file.
     */
    private static void savePayloadToFile(String payload, String filePath, boolean append) throws IOException {
        Path file = Paths.get(filePath);

        StandardOpenOption option = append ? StandardOpenOption.APPEND : StandardOpenOption.TRUNCATE_EXISTING;

        // Ghi nội dung vào file
        // Sử dụng Files.write để đơn giản hóa việc tạo/ghi
        Files.write(file, payload.getBytes(), StandardOpenOption.CREATE, option);
    }
    /**
     * Định dạng chi tiết lỗi của một test case.
     */
    private static String formatFailedCaseDetail(int index, String caseName, List<Map<String, String>> validateResults, ResponseValidator validator) {
        StringBuilder sb = new StringBuilder();
        sb.append("================================================================================\n");
        sb.append("[CASE FAILED] Index: ").append(index).append(", Name: ").append(caseName).append("\n");
        sb.append("================================================================================\n\n");

        // 1. Chi tiết Validation thất bại
        sb.append("--- VALIDATION FAILURES ---\n");
        validateResults.stream()
                .filter(result -> "Failed".equals(result.get("status")))
                .forEach(result -> sb.append(result.get("message")).append("\n"));
        sb.append("\n");

        // 2. Chi tiết Input (Request)
        sb.append(validator.getFailedCaseInputDetails()).append("\n");

        // 3. Chi tiết Output (Response) - Đã dùng Body được lọc từ ResponseValidator
        sb.append(validator.getFailedCaseResponseDetails()).append("\n");

        sb.append("--------------------------------------------------------------------------------\n"); // Phân cách
        return sb.toString();
    }
    // --- HÀM TIỆN ÍCH MỚI: LỌC HTML ---
    /**
     * Hàm tiện ích LỌC HTML. Trích xuất nội dung giữa thẻ <pre>...</pre>.
     */
    private static String extractPreContentFromHtml(String html) {
        // Regex để tìm nội dung trong thẻ <pre> (bao gồm cả đa dòng)
        Pattern pattern = Pattern.compile("<pre>([\\s\\S]*?)</pre>", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(html);

        if (matcher.find()) {
            // Lấy group 1 (nội dung bên trong thẻ <pre>) và loại bỏ các ký tự trắng thừa
            return matcher.group(1).trim();
        }

        // Nếu không tìm thấy thẻ <pre>, cố gắng lấy nội dung <title>
        Pattern titlePattern = Pattern.compile("<title>([\\s\\S]*?)</title>", Pattern.CASE_INSENSITIVE);
        Matcher titleMatcher = titlePattern.matcher(html);

        if (titleMatcher.find()) {
            // Trả về thông báo lỗi ngắn gọn từ tiêu đề
            return "[HTML ERROR] " + titleMatcher.group(1).trim();
        }

        // Trường hợp không có <pre> hoặc <title>, trả về thông báo lỗi chung
        return "[HTML ERROR] Response is HTML, content filtered/unparsable. Full body saved to log/tvc/payload_input.json.";
    }
    // --- CÁC HÀM GỬI PAYLOAD ---
    /**
     * Gửi payload LOG qua STDOUT.
     */
    private static void sendLog(String level, String content) {
        JSONObject logMessage = new JSONObject();
        logMessage.put("type", "LOG");
        logMessage.put("level", level);
        logMessage.put("content", content);
        STDOUT.println(logMessage.toString());
    }
    /**
     * Gửi payload LOG ERROR qua STDOUT.
     */
    private static void sendErrorLog(String level, String content) {
        sendLog(level, content);
    }
    /**
     * Gửi payload RESULT_CASE qua STDOUT sau khi một test case hoàn tất.
     * ĐÃ CẬP NHẬT: Thêm tham số String responseBody và thêm vào resultPayload.
     */
    private static void sendResultCase(int caseIndex, String caseName, String status, String message, List<Map<String, String>> validateResults, String responseBody, String moduleName, String testId) {
        JSONObject resultPayload = new JSONObject();
        resultPayload.put("status", status);
        resultPayload.put("message", message);
        resultPayload.put("test_id", testId);

        if (validateResults != null) {
            resultPayload.put("validate_results", new JSONArray(validateResults));
        } else {
            resultPayload.put("validate_results", new JSONArray());
        }

        // BỔ SUNG: THÊM RESPONSE BODY ĐÃ LỌC VÀO PAYLOAD
        JSONObject httpResponse = new JSONObject();
        httpResponse.put("body", responseBody != null ? responseBody : "");

        resultPayload.put("httpResponse", httpResponse);


        JSONObject finalMessage = new JSONObject();
        finalMessage.put("type", "RESULT_CASE");
        finalMessage.put("caseIndex", caseIndex);
        finalMessage.put("caseName", caseName);
        finalMessage.put("moduleName", moduleName);
        finalMessage.put("testId", testId);
        finalMessage.put("payload", resultPayload);

        STDOUT.println(finalMessage.toString());
    }
    /**
     * Gửi payload RUN_COMPLETE_CORE cuối cùng.
     */
    private static void sendRunCompleteCore(String status, String message) {
        JSONObject finalMessage = new JSONObject();
        finalMessage.put("type", "RUN_COMPLETE_CORE");
        finalMessage.put("status", status);
        finalMessage.put("content", message);

        STDOUT.println(finalMessage.toString());
    }
    // --- CÁC HÀM TIỆN ÍCH KHÁC ---
    private static String formatJson(String jsonString) {
        try {
            JSONObject json = new JSONObject(jsonString);
            return json.toString(2);
        } catch (Exception e) {
            return "--- DỮ LIỆU THÔ (KHÔNG PHẢI JSON HỢP LỆ) ---\n" + jsonString;
        }
    }
    private static void showReceivedDataWindow(String data) {
        SwingUtilities.invokeLater(() -> {
            JTextArea textArea = new JTextArea(data);
            textArea.setEditable(false);
            textArea.setFont(new java.awt.Font("Monospaced", java.awt.Font.PLAIN, 12));

            JScrollPane scrollPane = new JScrollPane(textArea);
            scrollPane.setPreferredSize(new java.awt.Dimension(800, 600));

            JOptionPane.showMessageDialog(
                    null,
                    scrollPane,
                    "[JAVA CORE] Dữ liệu Payload Đã Nhận Từ Node.js",
                    JOptionPane.INFORMATION_MESSAGE
            );
        });
    }
}