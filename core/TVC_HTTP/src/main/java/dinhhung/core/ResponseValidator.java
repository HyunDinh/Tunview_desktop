package dinhhung.core;

import lombok.Getter;
import okhttp3.Response;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Getter
public class ResponseValidator {

    private final List<Map<String, String>> validateResults;

    private String rawResponseBody;
    private String filteredResponseBody; // <<< TRƯỜNG MỚI ĐỂ LƯU BODY ĐÃ LỌC

    private String failedCaseInputDetails;
    private String failedCaseResponseDetails;

    public ResponseValidator() {
        this.validateResults = new ArrayList<>();
    }
    private String expectedCode;
    private String expectedResponseMessage;
    private String expectedResponseTime;
    private String[] expectedKeys;
    private String[] expectedValues;
    private long maxResponseTimeMs;
    private String customExpectedField;
    private String customExpectedData;

    // <<< SETTER MỚI CHO BODY ĐÃ LỌC >>>
    public void setFilteredResponseBody(String filteredResponseBody) {
        this.filteredResponseBody = filteredResponseBody;
    }
    // ------------------------------------

    public void validate(TestCase testCase) {
        validateResults.clear();
        // Reset chi tiết
        failedCaseInputDetails = null;
        failedCaseResponseDetails = null;

        // GÁN RESPONSE BODY THÔ
        this.rawResponseBody = testCase.getResponseBody();
        // ----------------------------------------------------

        if (!validateNoResponse(testCase.getResponse())){
            validateStatusCode(testCase);
            validateResponseMessage(testCase);
            validateResponseTime(testCase);

            if(customExpectedField != null && customExpectedData != null){
                expectedKeys = customExpectedField.split("\\|");
                expectedValues = customExpectedData.split("\\|");
            }
            if (expectedKeys != null && expectedValues != null) {
                if (expectedKeys.length == expectedValues.length) {
                    for (int i = 0; i < expectedKeys.length; i++) {
                        validateCustomField(testCase, expectedKeys[i], expectedValues[i]);
                    }
                } else {
                    // TODO: Log mismatch
                }
            }
        }

        // LOGIC MỚI: Ghi lại chi tiết input/response nếu case thất bại
        if (!isAllPassed()) {
            failedCaseInputDetails = formatCaseInputDetails(testCase);
            // SỬ DỤNG BODY ĐÃ LỌC Ở ĐÂY
            failedCaseResponseDetails = formatCaseResponseDetails(testCase);
        }
        // -------------------------------------------------------------------
    }

    private boolean validateNoResponse(Response response){
        if (response == null) {
            validateResults.add(createResult("Failed", "Validation: Response", "No response received"));
            return true;
        } else {
            return false;
        }
    }
    private void validateStatusCode(TestCase testCase) {
        if (expectedCode != null) {
            int actualCode = testCase.getResponse().code();
            validateResults.add(createResult(
                    actualCode == Integer.parseInt(expectedCode) ? "Passed" : "Failed",
                    "Validation: Response code",
                    actualCode == Integer.parseInt(expectedCode)
                            ? String.format("Response code matched: [%d]", actualCode)
                            : String.format("Response code not matched - Actual=[%s], Expected=[%s]", actualCode, expectedCode)
            ));
        }
    }
    private void validateResponseMessage(TestCase testCase) {
        if (expectedResponseMessage != null) {
            String actualMessage = testCase.getResponse().message();
            validateResults.add(createResult(
                    actualMessage.contains(expectedResponseMessage) ? "Passed" : "Failed",
                    "Validation: Response message",
                    actualMessage.contains(expectedResponseMessage)
                            ? String.format("Response message matched: [%s]", actualMessage)
                            : String.format("Response message not matched - Actual=[%s], Expected=[%s]", actualMessage, expectedResponseMessage)
            ));
        }
    }
    private void validateResponseTime(TestCase testCase) {
        if (expectedResponseTime != null) {
            maxResponseTimeMs = Long.parseLong(expectedResponseTime) * 1000L;
            long responseTimeMs = testCase.getResponseTimeMs();
            validateResults.add(createResult(
                    responseTimeMs <= maxResponseTimeMs ? "Passed" : "Failed",
                    "Validation: Response time",
                    responseTimeMs <= maxResponseTimeMs
                            ? String.format("Response time within limit: %dms <= %dms", responseTimeMs, maxResponseTimeMs)
                            : String.format("Response time exceeded - Actual: %dms, Expected: <= %dms", responseTimeMs, maxResponseTimeMs)
            ));
        }
    }
    private void validateCustomField(TestCase testCase, String key, String value) {
        // Lưu ý: Cần giả định class Utils và phương thức extractJsonField tồn tại
        String actualValue = Utils.extractJsonField(testCase.getResponseBody(), key);
        boolean contains = actualValue.toLowerCase().contains(value.toLowerCase());
        validateResults.add(createResult(
                contains ? "Passed" : "Failed",
                String.format("Validation: JSON field [%s]", key),
                contains ? String.format("Custom field data matched: [%s]-[%s]", key, value)
                        : String.format("Custom field data not matched with key [%s] - Actual=[%s], Expected=[%s]", key, actualValue, value)
        ));
    }

    // --- Phương thức hỗ trợ định dạng chi tiết đầu vào ---
    private String formatCaseInputDetails(TestCase testCase) {
        StringBuilder sb = new StringBuilder();
        sb.append("--- REQUEST DETAILS ---\n");
        sb.append("Method: ").append(testCase.getMethod()).append("\n");
        sb.append("API Path: ").append(testCase.getApi()).append("\n");
        sb.append("Request Body:\n").append(testCase.getBody() != null ? testCase.getBody() : "(N/A)").append("\n");
        return sb.toString();
    }

    // --- Phương thức hỗ trợ định dạng chi tiết đầu ra (ĐÃ SỬA) ---
    private String formatCaseResponseDetails(TestCase testCase) {
        StringBuilder sb = new StringBuilder();
        sb.append("--- RESPONSE DETAILS ---\n");
        if (testCase.getResponse() != null) {
            sb.append("Status Code: ").append(testCase.getResponse().code()).append("\n");
            sb.append("Response Time: ").append(testCase.getResponseTimeMs()).append("ms\n");

            // SỬ DỤNG filteredResponseBody HOẶC rawResponseBody (nếu filtered là null)
            String bodyToDisplay = this.filteredResponseBody != null ? this.filteredResponseBody : testCase.getResponseBody();

            sb.append("Response Body:\n").append(bodyToDisplay != null ? bodyToDisplay : "(N/A)").append("\n");
        } else {
            sb.append("No response received (response object is null).\n");
        }
        return sb.toString();
    }

    public String getFailedCaseInputDetails() { return failedCaseInputDetails; }
    public String getFailedCaseResponseDetails() { return failedCaseResponseDetails; }


    public ResponseValidator setExpectedCode(String expectedCode) {
        this.expectedCode = expectedCode;
        return this;
    }
    public ResponseValidator setExpectedResponseMessage(String expectedResponseMessage) {
        this.expectedResponseMessage = expectedResponseMessage;
        return this;
    }
    public ResponseValidator setCustomExpectedField(String customExpectedField) {
        this.customExpectedField = customExpectedField;
        return this;
    }
    public ResponseValidator setCustomExpectedData(String customExpectedData) {
        this.customExpectedData = customExpectedData;
        return this;
    }
    public ResponseValidator setExpectedResponseTime(String expectedResponseTime) {
        this.expectedResponseTime = expectedResponseTime;
        return this;
    }

    private Map<String, String> createResult(String status, String name, String message) {
        Map<String, String> result = new HashMap<>();
        result.put("status", status);
        result.put("message", name + " => " + message);
        return result;
    }
    public boolean isAllPassed() {
        return validateResults.stream().allMatch(result -> "Passed".equals(result.get("status")));
    }

}