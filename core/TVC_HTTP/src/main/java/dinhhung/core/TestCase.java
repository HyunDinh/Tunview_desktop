package dinhhung.core;

import com.fasterxml.jackson.databind.JsonNode;
import dinhhung.App;
import lombok.Getter;
import lombok.Setter;
import okhttp3.Response;

@Getter
@Setter
public class TestCase {

    private final String testId;
    private final String name;
    private final String api;
    private final HttpMethod method;
    private final String body; // Chuỗi JSON của request body
    private final ResponseValidator responseValidator;
    private final String authTokenStatus;
    private final boolean displayFullResponse;
    private final String moduleName;

    private Response response;
    private String responseBody;
    private long responseTimeMs;

    private final String expectedCode;
    private final String expectedResponseMessage;
    private final String expectedResponseTime;
    private final String customExpectedField;
    private final String customExpectedData;

    public TestCase(JsonNode caseNode) {

        this.testId                 = caseNode.has("test_id") ? caseNode.get("test_id").asText() : "N/A";
        this.name                   = caseNode.has("name") ? caseNode.get("name").asText()    : null;
        this.api                    = caseNode.has("api") ? caseNode.get("api").asText()        : null;
        this.method                 = HttpMethod.valueOf(caseNode.get("method").asText().toUpperCase());
        this.moduleName             = caseNode.has("parentFolder") ? caseNode.get("parentFolder").asText() : "General";

        // --- ĐOẠN CODE ĐÃ SỬA: Xử lý body là Object, Array, hoặc Text ---
        if (caseNode.has("body")) {
            JsonNode bodyNode = caseNode.get("body");

            // Kiểm tra nếu bodyNode là Object HOẶC Array (cấu trúc JSON)
            if (bodyNode.isObject() || bodyNode.isArray()) {
                this.body = bodyNode.toString(); // Chuyển đổi thành chuỗi JSON hợp lệ (ví dụ: "...")
            } else if (bodyNode.isValueNode() && !bodyNode.isNull()) {
                // Nếu là giá trị primitive (chuỗi, số, boolean) nhưng không phải null
                this.body = bodyNode.asText();
            } else {
                this.body = null;
            }
        } else {
            this.body = null;
        }
        // ------------------------------------------------------------------

        this.authTokenStatus        = caseNode.has("auth_token") ? caseNode.get("auth_token").asText() : "NO";
        this.displayFullResponse    = caseNode.has("display_full_response") && "TRUE".equalsIgnoreCase(caseNode.get("display_full_response").asText());

        this.expectedCode = (caseNode.has("expected_code") && !caseNode.get("expected_code").asText().isBlank())
                ? caseNode.get("expected_code").asText() : null;

        this.expectedResponseMessage = (caseNode.has("expected_response_message") && !caseNode.get("expected_response_message").asText().isBlank())
                ? caseNode.get("expected_response_message").asText() : null;

        this.expectedResponseTime = (caseNode.has("expected_response_time") && !caseNode.get("expected_response_time").asText().isBlank())
                ? caseNode.get("expected_response_time").asText() : null;

        this.customExpectedField = (caseNode.has("custom_expected_field") && !caseNode.get("custom_expected_field").asText().isBlank())
                ? caseNode.get("custom_expected_field").asText() : null;

        this.customExpectedData = (caseNode.has("custom_expected_data") && !caseNode.get("custom_expected_data").asText().isBlank())
                ? caseNode.get("custom_expected_data").asText() : null;

        this.responseValidator = new ResponseValidator()
                .setExpectedCode(this.expectedCode)
                .setExpectedResponseMessage(this.expectedResponseMessage)
                .setExpectedResponseTime(this.expectedResponseTime)
                .setCustomExpectedField(this.customExpectedField)
                .setCustomExpectedData(this.customExpectedData);
    }


    public void displayAllTestData() {
        if (App.IS_DEV_MODE){
            StringBuilder sb = new StringBuilder();

            sb.append("\n");
            sb.append("============================================================\n");
            sb.append("[TEST CASE DETAIL]\n");
            sb.append("------------------------------------------------------------\n");

            sb.append("Test ID               : ").append(testId).append("\n");
            sb.append("Name                  : ").append(name).append("\n");
            sb.append("API                   : ").append(api).append("\n");
            sb.append("Method                : ").append(method).append("\n");
            sb.append("Auth Token            : ").append(authTokenStatus).append("\n");

            sb.append("------------------------------------------------------------\n");
            sb.append("[REQUEST]\n");
            sb.append("Body                  : ")
                    .append(body != null ? body : "(empty)")
                    .append("\n");

            sb.append("------------------------------------------------------------\n");
            sb.append("[EXPECTED]\n");
            sb.append("Expected Code         : ").append(expectedCode).append("\n");
            sb.append("Expected Message      : ").append(expectedResponseMessage).append("\n");
            sb.append("Expected ResponseTime : ").append(expectedResponseTime).append("\n");
            sb.append("Custom Expected Field : ").append(customExpectedField).append("\n");
            sb.append("Custom Expected Data  : ").append(customExpectedData).append("\n");

            sb.append("------------------------------------------------------------\n");
            sb.append("[ACTUAL]\n");

            if (response != null) {
                sb.append("HTTP Status Code      : ").append(response.code()).append("\n");
            } else {
                sb.append("HTTP Status Code      : (no response)\n");
            }

            sb.append("Response Time (ms)    : ").append(responseTimeMs).append("\n");

            if (displayFullResponse) {
                sb.append("------------------------------------------------------------\n");
                sb.append("[FULL RESPONSE BODY]\n");
                sb.append(responseBody != null ? responseBody : "(empty)").append("\n");
            }

            sb.append("============================================================\n");

            System.out.println(sb);
        }
    }


}